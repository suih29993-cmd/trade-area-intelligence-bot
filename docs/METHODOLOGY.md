# 指标方法说明

本文说明演示项目如何从门店级合成数据计算商圈指标。所有公式都是作品集演示规则，不是行业标准，也不能直接用于真实经营决策。

## 1. 数据分层

### 原始层

每个商圈包含若干门店记录：

- `role`：`focus` 表示焦点品牌，`competitor` 表示竞品。
- `x`、`y`：以商圈中心为原点的局部平面坐标，单位 km。
- `monthlyOrders`：合成月售单量。
- `channels`：两个虚构渠道，各自包含配送费、活动深度、活动描述和红包值。

### 指标层

分析引擎先计算：

- 焦点门店总数、核心圈门店数、外围门店数。
- 竞品门店总数、竞品品牌数、品牌聚合月售。
- 焦点与竞品的模拟订单份额。
- 双渠道平均配送费、活动覆盖率、活动深度和红包覆盖率。

### 评分层

将指标归一化为五个 0–100 维度，再加权得到商圈健康度。

## 2. 距离与分区

门店到商圈中心的距离：

```text
d = sqrt(x² + y²)
```

- `d ≤ 1`：核心圈。
- `1 < d ≤ 3`：外围覆盖圈。
- 数据校验拒绝 `d > 3.05` 的记录。

## 3. 五维评分

### 门店覆盖

```text
coverage = clamp(
  30 + focusCount × 14 + coreCount × 12
     − max(0, competitorCount − focusCount) × 2,
  0, 100
)
```

解释：核心圈门店权重更高；竞品明显多于焦点品牌时扣分。

### 低竞对压力

```text
competition = clamp(
  100 − competitorCount × 5 − topBrandCount × 6 + focusCount × 4,
  0, 100
)
```

解释：分数越高表示竞对压力越低。`topBrandCount` 是竞品中门店数最多的品牌门店数。

### 活动力度

```text
promotion = clamp(
  55 + (focusPromoCoverage − competitorPromoCoverage) × 70
     + (focusPromoDepth − competitorPromoDepth) × 1.2,
  0, 100
)
```

- `*PromoCoverage`：至少一个渠道存在活动的门店占比。
- `*PromoDepth`：所有渠道活动百分比的平均值。

解释：不鼓励无差别补贴，只比较相对覆盖与深度。

### 销售体量

```text
focusShare = focusOrders / (focusOrders + competitorOrders)
sales = clamp(focusShare × 180, 0, 100)
```

解释：用模拟订单份额近似销售体量。份额 55.6% 对应约 100 分。

### 配送体验

```text
delivery = clamp(
  100 − focusAvgFee × 10
     − max(0, focusAvgFee − competitorAvgFee) × 10,
  0, 100
)
```

解释：配送费越低越好；高于竞品时额外扣分。

## 4. 综合健康度

```text
health = round(
  coverage × 0.20 +
  competition × 0.20 +
  promotion × 0.20 +
  sales × 0.25 +
  delivery × 0.15
)
```

分级：

- 85–100：强健。
- 70–84：稳健。
- 55–69：需关注。
- 0–54：偏弱。

## 5. 合成数据生成

`tools/generate_demo_data.py` 使用：

- 固定商圈参数：虚构客流强度、竞争强度、活动强度、配送费基线。
- SHA-256 派生的确定性伪随机流。
- 门店角色、距离、品牌因子、活动因子和订单噪声公式。

生成过程不读取任何真实数据文件，也不调用外部服务。重复运行产生同一份 JSON。

## 6. 解释边界

- 评分是演示用启发式模型，没有经过真实业务校准。
- 不同权重会改变排名，权重本身是可配置的产品假设。
- 活动和配送费只反映合成渠道字段，不代表任何真实平台规则。
- 多商圈对比只用于展示交互与分析方法，不能替代市场调研。
