import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePastedQuestion } from '../lib/question-parser.ts';

test('parses copied exam-page format with standalone option letters', () => {
  const parsed = parsePastedQuestion(`单选题
/1分
某企业启动一个采用新技术的项目，项目经理应首先采取何种行动？

A
评审风险登记册，将职能经理列为项目资源

B
分析企业资源池，指派参与过过去项目的内部资源加入本项目

C
分析核心成本驱动因素，并提出替代解决方案

D
评审工作分解结构，确保项目资源配置充足

答案
回答错误得0分
正确答案： C
你的答案： D

解析
在不增加项目交付风险的前提下降低人工成本，首要步骤是分析核心成本驱动因素。`);

  assert.equal(parsed.type, 'single');
  assert.equal(parsed.prompt, '某企业启动一个采用新技术的项目，项目经理应首先采取何种行动？');
  assert.equal(parsed.optionCount, 4);
  assert.deepEqual(parsed.answers, ['C']);
  assert.equal(parsed.options.A, '评审风险登记册，将职能经理列为项目资源');
  assert.equal(parsed.options.D, '评审工作分解结构，确保项目资源配置充足');
  assert.match(parsed.explanation, /^在不增加项目交付风险/);
});

test('keeps support for inline options and multiple answers', () => {
  const parsed = parsePastedQuestion(`多选题
应采取哪些行动？
A. 开展回顾
B. 延迟测试
C. 消除障碍
D. 冻结待办事项
E. 团队协作
答案：A，C，E
答案解析：持续改进需要团队共同参与。`);

  assert.equal(parsed.type, 'multiple');
  assert.equal(parsed.optionCount, 5);
  assert.deepEqual(parsed.answers, ['A', 'C', 'E']);
  assert.equal(parsed.explanation, '持续改进需要团队共同参与。');
});
