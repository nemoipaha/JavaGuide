---
title: RAG 文档处理与切分策略：从解析、清洗、Chunking 到多模态内容处理
description: 深入解析 RAG 文档进入索引前的完整链路，涵盖文件解析、清洗、结构化、Chunking 策略、语义丢失处理、分层校验与多模态内容处理等工程化实践。
category: AI 应用开发
head:
  - - meta
    - name: keywords
      content: RAG,文档解析,切分,PDF解析,多模态RAG,语义丢失,表格处理,OCR,CLIP,结构化,知识库
---

> **术语约定**：本文中 "Chunking" 与“切分”、"Embedding" 与“嵌入”、"Chunk" 与“块” 含义相同，统一使用中文表述以保持可读性。

<!-- @include: @article-header.snippet.md -->

很多团队第一次搭 RAG 系统时，都会经历一个特别有意思的阶段：买最贵的向量数据库、调最牛的 embedding 模型、上线之后发现答案还是一塌糊涂。

根因往往不在检索环节，而在更上游——文档根本没有被正确解析，切分的时候把表格列拆散了，Chunk 把条件和结论切成两半，页眉页脚被当成正文入了索引。

换句话说：**RAG 的瓶颈通常不在检索层，而在文档进入索引之前的那段管线。**

这个问题在 PDF 多栏布局、Word 标题层级、Excel 字段关联、扫描件 OCR 等场景下尤其突出。很多团队以为换了更强的 embedding 模型就能解决，实际上只是让错误表达得更稳定而已。

今天这篇文章就来系统梳理 RAG 文档处理的完整链路，帮你搞清楚每个环节的核心风险点和应对策略。本文接近 1.5w 字，建议收藏，通过本文你将搞懂：

1. **文档处理链路**：从上传到入库要经过哪些环节？每个环节的核心风险点是什么？
2. **Chunking 策略**：结构优先、长度兜底、重叠控制、父子 Chunk 的权衡取舍。
3. **语义丢失处理**：语义丢失的本质，以及它为什么会发生。
4. **结构化问题**：表格、多栏布局、标题层级等结构丢失问题的典型场景和应对方案。
5. **分层校验策略**：空文件、解析失败、低质量文档如何处理。
6. **多模态内容**：图片、表格、图表如何转成可检索内容。

## 文档从上传到入库要经过哪些环节？

在说具体策略之前，先把链路画清楚。文档从上传到进入向量库，中间要经过至少六个环节：

```mermaid
flowchart LR
    %% ========== 配色声明 ==========
    classDef client fill:#00838F,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef process fill:#E99151,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef storage fill:#3498DB,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef quality fill:#C44545,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef success fill:#27AE60,color:#FFFFFF,stroke:none,rx:10,ry:10

    %% ========== 节点声明 ==========
    Upload[文件上传]:::client
    Validate[格式校验<br/>大小检查]:::process
    Parse[Layout 解析<br/>结构识别]:::process
    Clean[清洗去噪<br/>结构化]:::process
    Chunk[Chunking<br/>切分]:::process
    Meta[Metadata<br/>元数据绑定]:::process
    Index[向量入库<br/>索引构建]:::storage

    QC{质量校验}:::quality
    Pass[通过]:::success
    Reject[拒绝/<br/>降级处理]:::quality
    Retry[重试/<br/>人工介入]:::quality

    Upload --> Validate --> Parse --> Clean --> Chunk --> Meta --> Index
    Chunk -->|采样校验| QC
    QC -->|达标| Pass
    QC -->|不达标| Reject
    Reject -->|可修复| Retry
    Reject -->|不可修复| Pass

    linkStyle default stroke-width:2px,stroke:#333333,opacity:0.8
```

这张图里有一个关键点：**质量校验不应该只发生在入库之后**。在 Chunking 阶段做完采样校验，能提前发现问题，避免把低质量数据大批量写入向量库。

> 注：本图简化展示了 Chunking 阶段的校验，完整的分层校验策略见后文“如何设计分层校验策略”章节，涵盖格式校验、解析校验和 Chunking 校验三层。

**每个环节的核心风险**：

| 环节        | 典型问题                           | 最终影响                   |
| ----------- | ---------------------------------- | -------------------------- |
| 文件上传    | 格式伪造、大小超限、编码混乱       | 解析器崩溃或静默失败       |
| 格式校验    | 扩展名和实际 MIME 类型不符         | 选错解析器                 |
| Layout 解析 | PDF 多栏、表格合并单元格、页眉页脚 | 结构丢失、上下文错位       |
| 清洗去噪    | 乱码、特殊字符、重复空行、目录残留 | 噪声入索引、Embedding 失真 |
| Chunking    | 语义截断、上下文断裂、块太大或太小 | 召回不准、答案残缺         |
| Metadata    | 没保存来源、页码、版本、权限       | 无法过滤、无法引用         |
| 入库        | 向量维度不一致、Token 超限         | 检索失败、索引损坏         |

很多团队把精力放在换哪个 embedding 模型上面，但实际上如果数据在这一步就已经坏掉了，换模型只会让损坏更稳定。

## 如何选择合适的 Chunking 策略？

### 固定长度切分：够用但不完美

最朴素的做法是按字符数或 Token 数硬切。比如每 1000 个 Token 切一块，相邻块之间重叠 200 Token。

这种方式实现简单、行为可预测，在短文档和 FAQ 类场景下效果不差。但它的硬伤也很明显：**它不懂什么是段落、什么是表格、什么是代码块。**

在实际测试中，固定 512-token 切分与递归切分的差距其实很小——大约只有 2 个百分点。对于快速验证 RAG 可行性的场景，这个差距可能不值得引入额外的复杂度。

举个例子，一段政策文档里写着：

> “除以下情况外，均可申请七天无理由退货：（一）定制商品；（二）鲜活易腐商品；（三）在线下载的数字化商品...”

如果这个列表刚好跨在 1000 Token 的边界上，前一块可能只有“除以下情况外，均可申请七天无理由退货”，后一块只有“（一）定制商品...”。单独看哪个都不完整，模型很容易断章取义。

所以固定长度只适合当**基线**用，不适合当**终点**。

### 递归字符切分：保留层级结构

递归切分（Recursive Character Splitting）的思路是按层级逐层拆分：先按换行符切，再按句号切，再按空格切，直到每个块都小于目标大小。

这听起来像是在模拟人类读文档的方式：先看章节标题，再看段落，再看句子。

LangChain 的 `RecursiveCharacterTextSplitter` 是这种思路的典型实现。对于 Python 代码这类结构化内容，使用约 100 Token 的块大小和约 15 Token 的重叠，能在上下文精度和召回率之间取得不错的平衡。注意：此参数针对代码文档优化，通用文本文档建议使用 400-512 Token。

递归切分适合**有一定结构但结构不规则的文档**，比如技术博客、产品手册、研究报告。

### 语义切分：按意义分，但有代价

语义切分的思路更进一步：不按字符或层级切，而是用 embedding 模型判断句子之间的语义相似度，把相近的句子聚成一组。

实际测试下来，语义切分有一个常见陷阱——**容易产生超小块**。比如某次评测中，语义切分产生的片段平均只有 43 Token，这么小的块上下文严重不足，反而影响效果。

语义切分还有一个问题：**它需要额外的 embedding 调用来计算句子相似度**，对于大规模文档来说成本不低。

> 补充说明：语义切分的性能对阈值和最小块大小参数极为敏感。设置合理的 min_chunk_size（如 200-400 Token）可以避免超小片段问题，在调优良好的情况下表现会有显著提升。

### 按文档结构切：天然语义边界

如果文档本身有清晰的结构，按结构切反而是最靠谱的。比如某些测试中，Page-Level Chunking（按页面切分）表现最好，平均准确率达到 0.648，方差也最低。这个结果说明：当页面边界本身就是文档作者设定的语义边界时，不要强行拆散它。

需要注意的是，该优势相对于 Token 切分仅为 0.3-4.5 个百分点，且在部分数据集上 1024-token 切分反而更优（FinanceBench 上 1024-token 达到 0.579 而页面级为 0.566）。NVIDIA 测试的文档类型（金融报告、法律文档等）是分页本身携带语义的场景——对于任意分页的文本导出类 PDF，页面级切分不会带来额外收益。不同查询类型也影响最优策略：事实型查询适合 256-512 Token 的小块，分析型查询适合 1024+ Token 或页面级切分。

常见的结构化切分方式：

| 文档类型 | 推荐切分方式                  | 实现工具                          |
| -------- | ----------------------------- | --------------------------------- |
| Markdown | 按标题层级（H1/H2/H3）切      | `MarkdownHeaderTextSplitter`      |
| HTML     | 按标签层级切（h1~h6、p、div） | `HTMLHeaderTextSplitter`          |
| PDF      | 按页或章节切                  | `chunk_by_title`、`chunk_by_page` |
| 代码     | 按函数、类、包切              | `PythonCodeTextSplitter`          |
| 论文     | 按章节、段落、表格切          | Layout-aware Parser               |

### Parent-Child Chunk：召回和上下文的折中

一个高频痛点是：**小块召回准但上下文残缺，大块保留完整但召回噪声大**。

Parent-Child Chunk 就是来解决这个矛盾的。做法是：

1. 把文档切成 300 Token 左右的小块，用于向量检索。
2. 每个小块都挂载到一个 1200 Token 的父段落上。
3. 检索时先命中小块，再把对应父段落放入上下文。

这样既保证了召回精度，又保留了必要的上下文。

```mermaid
flowchart TB
    subgraph 索引阶段
        Doc[原始文档] --> Split[切分成小块]
        Doc --> Parent[标记父段落]
        Split --> ChildChunk[子 Chunk<br/>300 Token]
        Parent --> ParentChunk[父 Chunk<br/>1200 Token]
        ChildChunk --> VecIndex[向量索引]
        ChildChunk -->|关联| ParentChunk
    end

    subgraph 检索阶段
        Query[用户 Query] --> VecIndex
        VecIndex -->|命中| MatchedChild[匹配子 Chunk]
        MatchedChild -->|查询关联| ParentChunk
        ParentChunk --> Context[进入上下文]
    end

    linkStyle default stroke-width:2px,stroke:#333333,opacity:0.8
```

这种模式在长文档、教程、政策解读、故障手册等场景下效果明显。缺点是索引存储量会增加（每个子 Chunk 都要关联父 Chunk），检索时多一次关联查询。

### 重叠控制：边界问题的解法

无论用哪种切分策略，块边界都是个问题。连续两页的内容，上一页结尾和下一页开头可能讲的是同一件事，但被页码切开了。

重叠（Overlap）是应对这个问题的标准手段。但重叠也不是越大越好：

- 重叠太小：边界处语义断裂。
- 重叠太大：重复内容过多，浪费向量空间，增加检索噪声。

有实际测试表明，按逻辑主题边界对齐的自适应切分可以取得不错的效果——准确率达到 87%，而固定大小基线为 50%，差距在统计上显著（p = 0.001）。

我的经验值：

- 通用文本：块大小 512 Token，重叠 50-100 Token。
- 代码文档：块大小按函数/类边界，不硬套 Token 数。
- 法规合同：按条、款、项结构切，优先保留法律效力单元。
- 表格密集文档：表格作为独立块，不跨块切分。

## 什么是语义丢失，为什么会发生？

语义丢失是 RAG 系统里一个容易被忽视但影响巨大的问题。它的意思是：**原始文档里的关键信息，在解析、清洗、切分、入库的过程中被削弱或丢失了**。

### 语义丢失的典型场景

**第一种：结构截断**。一个完整的业务逻辑被拆到两个 Chunk 里。第一个 Chunk 讲“申请条件”，第二个 Chunk 讲“审批流程”，但中间那个关键条件“如果满足 X，则需要额外提供 Y 材料”被切在边界上，成了两个 Chunk 都有的“残缺信息”。

**第二种：上下文蒸发**。Chunk 只保留了文本内容，但丢失了它在文档里的位置信息。模型读到“在过去三年中...”时不知道这是在讲“某供应商的风险评估”还是“某客户的历史交易”，因为这些背景在切分时被丢了。

**第三种：表格结构破坏**。一个多行多列的表格被解析成混乱的文本，列与列之间的语义关系（谁是主键、谁是从属、谁是数值）完全丢失。

**第四种：专有名词变形**。文档里写的是“SSO 单点登录”，切分后变成了“SSO 单点...”，embedding 时专有名词被截断，检索时根本匹配不到。

### 语义丢失的本质

说到底，语义丢失的本质是：**切分破坏了原始文本的上下文依赖关系，而 Embedding 模型只能看到切分后的局部窗口**。

Transformer 的注意力机制虽然能处理长距离依赖，但每个 Token 最终只能“看到”它所在 Chunk 内的上下文。如果关键信息跨越了 Chunk 边界，模型就没有足够的信息来正确理解它。

这也解释了为什么 Page-Level Chunking 在某些场景下反而比精细切分效果更好——当页面本身就是语义单元时，按页面切反而保留了更多的原始上下文。

### 应对策略

**策略一：增加语义入口**。不要只索引正文，给每个 Chunk 生成摘要和问题变体一起入索引。用户问“钱怎么退”，文档写的是“退款申请路径”，这两个表达不在同一个语义空间，但都指向同一个答案。给 Chunk 生成多角度的摘要或问题，可以增加命中的概率。

**策略二：保留层级元数据**。在 Metadata 里记录章节路径、父子标题、段落编号等信息。检索时可以按层级过滤，也可以在生成时补回上下文。

**策略三：Late Chunking**。这是一种新兴做法：先把完整文档通过 Transformer 编码一次，让每个 Token 的 embedding 都包含全文注意力，然后再在 embedding 空间做切分和池化。好处是每个 Chunk 的向量都保留了完整的文档上下文，缺点是计算成本高。

**策略四：Contextual Chunking**。用另一个 LLM 来分析文档结构，生成“应该如何切分”的建议。这种方式成本高，但能处理复杂的文档结构。

## 如何处理结构丢失问题？

结构丢失是语义丢失的一个子集，但它的场景更具体，影响也更直接。

### PDF 多栏布局

PDF 是最麻烦的格式之一。很多 PDF 的正文是双栏甚至多栏排版的，但底层文本流可能是混乱的——第一栏的第三段后面可能跟着第三栏的第一段，解析时如果按物理顺序读，就会得到一堆乱码。

应对方案：

1. **使用 Layout-Aware Parser**。这类解析器会识别文本的物理位置（x、y 坐标）、字体大小、段落间距，从而推断出真实的阅读顺序。LlamaParse、Docling、Marker-PDF 都支持这个能力。
2. **多版本解析对比**。同一个 PDF 用两种解析器跑一遍，检查输出的一致性。如果两份输出差异很大，说明解析结果不可靠，应该降级处理或标记为需要人工审核。
3. **检测表格跨栏**。财务报表里的合并单元格是解析噩梦。跨列的表头、跨行的数值项，如果只按文本流解析，结构会完全乱掉。这类文档建议用专门的表格提取工具（如 Docling 的 TableFormer 模块）处理。

### Word 标题层级

Word 文档的结构通常靠标题样式体现（Heading 1、Heading 2、正文）。但很多文档的标题样式被滥用——有人用加大字体的普通段落当标题，有人把正文套成了 Heading 3。

如果直接按纯文本切分，标题层级会全部丢失。

更好的做法是：

1. 用 `python-docx` 读取文档的样式信息，按样式层级重建文档树。
2. 按标题层级切分，保证每个 Chunk 都知道自己属于哪个章节。
3. 把章节路径写入 Metadata，供检索和生成时使用。

```python
# 读取 Word 文档并保留标题层级
from docx import Document

def extract_sections(doc_path):
    """
    按 Word 文档标题层级提取章节内容
    """
    doc = Document(doc_path)
    current_heading = None
    current_content = []

    for para in doc.paragraphs:
        if para.style.name.startswith("Heading"):
            # 保存上一个标题下的内容
            if current_heading and current_content:
                yield {
                    "heading": current_heading,
                    "content": "\n".join(current_content),
                }
            current_heading = para.text
            current_content = []
        else:
            if para.text.strip():
                current_content.append(para.text)

    # 处理最后一个章节
    if current_heading and current_content:
        yield {
            "heading": current_heading,
            "content": "\n".join(current_content),
        }
```

### Excel 字段关联

Excel 表格是结构化数据，但它的结构往往藏在单元格的合并、颜色、公式里，而不是文本本身。

一个常见的错误是把 Excel 当作文本文件来处理——按行读取，每个单元格独立入索引。这样做会丢失列与列之间的关联关系。

正确的做法取决于 Excel 的用途：

- **数据表格**（财务报表、统计报表）：按行或按数据区域提取为结构化 JSON，每行作为一条记录。
- **配置表格**（参数表、映射表）：把表头和值配对提取，保留字段名。
- **混合文档**（既有说明文字又有表格）：文字部分按段落处理，表格部分按结构化数据处理。

### 扫描件的 OCR 质量

扫描件的处理更复杂。纸质文档通过 OCR 转成数字文本，质量取决于扫描分辨率、字体、纸张背景等多个因素。

常见的 OCR 问题：

- **字符错识别**：数字 0 和字母 O 混淆、中文繁简体混淆。
- **行错位**：表格线识别不准，导致行列错位。
- **段落合并**：不同段落的文本被合并成一段。

应对方案：

1. 使用支持神经网络的 OCR 引擎（如 Tesseract 4.x+、Google Document AI、AWS Textract），不要用传统的光学字符识别。
2. 对关键文档启用双 OCR 引擎交叉校验。
3. 对数值密集型文档（如财务报表）增加数值一致性校验。

## 如何设计分层校验策略？

不是所有文档都能成功解析，也不是所有解析结果都能用。RAG 管线必须有降级处理机制，否则低质量数据会污染整个知识库。

### 校验分层

**第一层：格式校验**。文件上传后先检查扩展名、MIME 类型、文件大小。这一层解决的是“恶意上传”和“参数错误”问题。

```java
public class DocumentValidationException extends RuntimeException {
    private final ValidationErrorType errorType;
    private final String fileName;
    private final Object rejectedValue;

    public enum ValidationErrorType {
        FILE_TOO_LARGE,           // 文件大小超限
        UNSUPPORTED_FORMAT,       // 不支持的格式
        MIME_TYPE_MISMATCH,       // 扩展名与实际类型不符
        CORRUPTED_FILE,           // 文件损坏
        EMPTY_FILE,               // 空文件
        ENCODING_ERROR            // 编码错误
    }
}
```

**第二层：解析校验**。解析完成后检查是否成功提取了内容、内容长度是否在合理范围内、是否有明显的乱码。

```java
public class ParseResultValidator {

    public ValidationResult validate(DocumentParseResult parseResult) {
        List<String> errors = new ArrayList<>();

        // 空内容检查
        if (parseResult.getContent().isEmpty()) {
            errors.add("解析结果为空");
        }

        // 乱码率检查
        double garbledRate = calculateGarbledRate(parseResult.getContent());
        if (garbledRate > 0.05) {  // 超过 5% 乱码
            errors.add("乱码率过高: " + String.format("%.2f%%", garbledRate * 100));
        }

        // 内容长度异常检查
        int contentLength = parseResult.getContent().length();
        if (contentLength < 100) {
            errors.add("内容过短，可能解析失败");
        }
        if (contentLength > 10_000_000) {  // 超过 10MB 文本
            errors.add("内容过长，需要分片处理");
        }

        // 结构完整性检查（如果有结构信息）
        if (parseResult.hasStructure()) {
            validateStructure(parseResult.getStructure())
                .forEach(errors::add);
        }

        return new ValidationResult(errors);
    }
}
```

**第三层：Chunking 校验**。切分完成后抽样检查 Chunk 质量：块大小分布是否合理、边界是否在合理位置、是否有明显的截断问题。

```java
public class ChunkingQualityReport {
    private final int totalChunks;
    private final int totalCharacters;
    private final double averageChunkSize;
    private final int minChunkSize;
    private final int maxChunkSize;
    private final double chunkSizeStdDev;

    // 警告项
    private final List<String> warnings = new ArrayList<>();
    private final List<String> errors = new ArrayList<>();

    public boolean isAcceptable() {
        // Chunk 大小标准差过大说明分布不均匀
        if (chunkSizeStdDev > averageChunkSize * 0.5) {
            warnings.add("Chunk 大小分布不均匀，标准差过大");
        }

        // 最小块过小可能是切分异常
        if (minChunkSize < 50) {
            errors.add("存在过小的 Chunk，可能切分异常");
        }

        // 最大块过大可能截断失败
        if (maxChunkSize > 5000) {
            warnings.add("存在过大的 Chunk，可能超出模型上下文");
        }

        return errors.isEmpty();
    }
}
```

### 降级处理策略

| 校验失败类型  | 处理策略                                  |
| ------------- | ----------------------------------------- |
| 空文件        | 拒绝入库，记录异常日志，通知上传者        |
| 格式不支持    | 拒绝入库，建议转换格式                    |
| 解析失败      | 进入人工处理队列，或使用备用解析器重试    |
| 乱码率高      | 尝试 OCR 或格式转换，仍失败则降级为纯文本 |
| Chunking 异常 | 改用固定长度切分作为兜底方案              |
| 部分解析成功  | 提取可解析部分入库，对不可解析部分打标签  |

降级不是放弃，而是**让尽可能多的有效数据进入知识库**。一份 100 页的 PDF，解析失败 10 页，总比全部拒绝强。

## 如何处理多模态内容？

传统 RAG 只处理文本，但真实世界的文档里还有大量图片、表格、图表。如果这些内容被忽略，知识库就是不完整的。

### 图片内容：三种处理路径

图片在文档里的作用有两类：**信息载体**（截图、流程图、照片）和**装饰性内容**（页眉、logo、水印）。处理策略完全不同。

**路径一：CLIP 向量化 + 原始图片回传**。用 CLIP 模型把图片转成向量，和文本向量一起存入向量库。检索时如果命中图片向量，就从对象存储里拉取原始图片，编码成 base64 塞给多模态 LLM（如 GPT-4o）做理解。

这套方案的好处是图片和文本在同一个语义空间里检索，坏处是 CLIP 擅长自然图片，对截图和图表的理解能力有限。

**路径二：MLLM 描述 + 文本检索**。不用 CLIP 向量化图片，而是用多模态大模型（如 GPT-4o、Qwen-VL）生成图片的文本描述，把描述文本和原始图片一起存储。检索时直接匹配文本，命中后再用原始图片做生成增强。

这套方案更实用——很多企业文档里的图片是截图、流程图、仪表盘，CLIP 很难理解，但 MLLM 能生成准确的描述。

**路径三：多向量索引（Multi-Vector Retriever）**。这是 LangChain 主推的方案：

1. 用 MLLM 生成图片的结构化摘要（如"This is a flowchart showing the order processing pipeline..."）。
2. 摘要入文本向量索引，原图存在 docstore 里。
3. 检索时先命中摘要，再通过 doc_id 关联拉取原图。
4. 把原图 base64 编码后一起塞给多模态 LLM 生成。

```python
# LangChain 多向量检索示例
from langchain.retrievers import MultiVectorRetriever
from langchain.storage import InMemoryByteStore

# 摘要向量存储
vectorstore = Chroma(collection_name="summaries", embedding_function=OpenAIEmbeddings())

# 原始文档存储
docstore = InMemoryByteStore()

retriever = MultiVectorRetriever(
    vectorstore=vectorstore,
    byte_store=docstore,
    id_key="doc_id",
    search_kwargs={"k": 5}
)
# 注意：InMemoryByteStore 仅用于演示，生产环境应替换为持久化存储（如 Redis、MongoDB、S3 等）
```

### 表格内容：结构化抽取是核心

表格是 RAG 里的老大难问题。传统 PDF 解析会把表格转成混乱的文本，列与列之间的关系完全丢失。

**方案一：表格解析 + Markdown 化**。用专门的表格解析工具（LlamaParse、Docling、TableFormer）提取表格结构，转成 Markdown 表格格式。Markdown 表格至少保留了行列关系，LLM 能更好地理解。

```markdown
| 产品名称 | Q1 销量 | Q2 销量 | 环比增长 |
| -------- | ------- | ------- | -------- |
| 手机 A   | 10,000  | 12,000  | +20%     |
| 手机 B   | 8,000   | 7,500   | -6.25%   |
```

**方案二：表格转结构化 JSON**。如果表格是数值型的（比如财务报表），转成 JSON 格式更利于数值检索和计算。可以用自然语言查询表格内容："Which product had the highest growth in Q2?"

```json
{
  "table_name": "Sales Quarterly Report",
  "headers": ["Product", "Q1 Sales", "Q2 Sales", "Growth Rate"],
  "rows": [
    { "product": "Phone A", "q1": 10000, "q2": 12000, "growth": "20%" },
    { "product": "Phone B", "q1": 8000, "q2": 7500, "growth": "-6.25%" }
  ]
}
```

**方案三：上下文感知的表格描述**。普通的表格描述是"This is a table showing sales data..."，但这种描述丢失了表格的业务背景。上下文感知的方式是：先识别表格所在的章节和主题，再用这些背景信息丰富表格描述。

比如同样是销售数据表，在“华东区年度总结”章节下的描述应该是：

> “华东区 2024 年度各产品线销量汇总表，展示了手机 A 和手机 B 在 Q1/Q2 的销售数据及环比增长率，用于分析产品市场表现和制定下季度策略。”

两种描述的检索命中率差异很大。

### 图表内容：Caption 和上下文同样重要

图表（折线图、柱状图、饼图、流程图）比普通图片更复杂，因为它们往往有标题、坐标轴标签、图例等元信息。

处理图表的要点：

1. **提取完整的图表元信息**。标题、坐标轴标签、图例、单位、数据来源，这些信息对理解图表至关重要。
2. **生成描述性 caption**。不是"Revenue chart"，而是“折线图展示 2020-2024 年公司季度营收趋势，Q4 2024 营收达到峰值 12.5 亿元”。
3. **识别图表与其他内容的关系**。图表通常是为说明某个论点服务的，它的上文和下图往往包含关键解读。

### 完整的多模态 RAG 链路

```mermaid
flowchart LR
    %% ========== 配色声明 ==========
    classDef input fill:#00838F,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef process fill:#E99151,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef storage fill:#3498DB,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef llm fill:#9B59B6,color:#FFFFFF,stroke:none,rx:10,ry:10
    classDef success fill:#27AE60,color:#FFFFFF,stroke:none,rx:10,ry:10

    %% ========== 节点声明 ==========
    Doc[多格式文档]:::input
    Parser[Layout 解析器<br/>LlamaParse/Docling]:::process
    TextBranch[文本分支]:::process
    TableBranch[表格分支]:::process
    ImageBranch[图片分支]:::process

    TextSum[文本摘要]:::llm
    TableSum[表格结构化]:::process
    ImageSum[图片 MLLM 描述]:::llm

    VecIndex[(向量索引)]:::storage
    DocStore[(DocStore<br/>原始素材)]:::storage

    Query[用户 Query]:::input
    Retrieve[多向量检索]:::process
    Synthesize[多模态 LLM<br/>综合生成]:::llm
    Answer[最终答案]:::success

    Doc --> Parser
    Parser --> TextBranch
    Parser --> TableBranch
    Parser --> ImageBranch

    TextBranch --> TextSum --> VecIndex
    TextBranch -->|原文| DocStore
    TableBranch --> TableSum --> VecIndex
    TableBranch -->|原始表格| DocStore
    ImageBranch --> ImageSum --> VecIndex
    ImageBranch -->|原始图片| DocStore

    Query --> Retrieve
    VecIndex --> Retrieve
    Retrieve -->|命中摘要| DocStore
    DocStore -->|原始素材| Synthesize
    Retrieve -->|命中摘要| Synthesize
    Synthesize --> Answer

    linkStyle default stroke-width:2px,stroke:#333333,opacity:0.8
```

这套链路的核心思想是：**摘要用于检索，原文用于生成**。向量索引里存的是结构化摘要（或描述），而原始的多模态内容存在 docstore 里，检索命中的时候再取出来交给多模态 LLM 综合。

## 如何从零搭建文档处理管线？

如果你要从零搭一套企业级 RAG 的文档处理管线，Guide 的建议是分阶段做：

**第一阶段：基线稳过**。先让文本类文档（Markdown、HTML、TXT）能稳定走通解析、切分、索引、入库全流程。这一阶段重点验证：解析器能否正确提取标题层级、Chunk 大小分布是否符合预期、Metadata 是否完整。

**第二阶段：PDF 专项攻坚**。PDF 是企业文档的主力格式，表格、图表、多栏是重灾区。建议引入 Layout-Aware Parser（LlamaParse 或 Docling），先在少量文档上验证表格和图片提取质量，再逐步扩大覆盖范围。

**第三阶段：多模态扩展**。当文本链路稳定后，再引入图片和表格的多模态处理。这一阶段的优先级可以根据业务场景调整——如果文档里图片和表格占比高（比如财务报告、产品手册），就要优先做；如果主要是文字类文档，可以延后。

**第四阶段：质量闭环**。没有质检的管线是不可靠的。建议在入库前增加抽样质检环节：用一批真实用户 Query 定期跑召回，对比解析前后的内容保真度，持续迭代解析器和切分策略。

## 总结

RAG 文档处理不是一个“调参数”的问题，而是一个**系统工程**。每个环节都有自己独特的挑战：

- **解析层**：要理解文档结构，Layout-Aware 是基础能力。
- **清洗层**：要去噪但不丢信息，乱码和重复内容是主要敌人。
- **Chunking 层**：要找到语义完整性和召回精度的平衡点，没有万能值，只有场景适配。
- **Metadata 层**：要保存足够多的上下文信息，来源、版本、权限、层级路径都是检索和生成的硬约束。
- **多模态层**：图片和表格是信息的重要载体，不能简单跳过，需要专门的抽取和描述策略。

最后记住一句话：**RAG 的上限由数据质量决定，下限由检索策略决定**。把数据处理管线做到位，比换一百个 embedding 模型都管用。

## 参考资料

- [Databricks: Mastering Chunking Strategies for RAG](https://community.databricks.com/t5/technical-blog/the-ultimate-guide-to-chunking-strategies-for-rag-applications/ba-p/113089)
- [Firecrawl: Best Chunking Strategies for RAG in 2026](https://www.firecrawl.dev/blog/best-chunking-strategies-rag)
- [Premiere AI: RAG Chunking Strategies 2026 Benchmark Guide](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/)
- [Weaviate: Chunking Strategies to Improve LLM RAG Pipeline Performance](https://weaviate.io/blog/chunking-strategies-for-rag)
- [Omdena: Document Parsing for RAG - A Complete Guide for 2026](https://www.omdena.com/blog/document-parsing-for-rag)
- [DataCamp: Multimodal RAG - A Hands-On Guide](https://www.datacamp.com/tutorial/multimodal-rag)
- [LangChain: Multi-Vector Retriever for RAG on Tables, Text, and Images](https://www.langchain.com/blog/semi-structured-multi-modal-rag)
- [Procycons: PDF Data Extraction Benchmark 2025](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/)
- [LlamaIndex: Mastering PDF Parsing](https://www.llamaindex.ai/blog/mastering-pdfs-extracting-sections-headings-paragraphs-and-tables-with-cutting-edge-parser-faea18870125)
