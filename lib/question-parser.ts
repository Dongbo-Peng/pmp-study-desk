export type ParsedLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type ParsedQuestionType = 'single' | 'multiple';

const emptyOptions = (): Record<ParsedLetter, string> => ({ A: '', B: '', C: '', D: '', E: '' });

export function parsePastedQuestion(raw: string) {
  const lines = raw.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const options = emptyOptions();
  const questionLines: string[] = [];
  const explanationLines: string[] = [];
  let answers: ParsedLetter[] = [];
  let explicitType: ParsedQuestionType | null = null;
  let currentOption: ParsedLetter | null = null;
  let section: 'question' | 'options' | 'answer' | 'explanation' = 'question';

  for (const line of lines) {
    if (/^单选题(?:\s|$)/.test(line)) { explicitType = 'single'; continue; }
    if (/^多选题(?:\s|$)/.test(line)) { explicitType = 'multiple'; continue; }
    if (/^\/?\d+(?:\.\d+)?\s*分$/.test(line)) continue;

    const explanationMatch = line.match(/^(?:答案)?解析(?:[：:]\s*|\s*$)(.*)$/);
    if (explanationMatch) {
      section = 'explanation'; currentOption = null;
      if (explanationMatch[1]) explanationLines.push(explanationMatch[1]);
      continue;
    }

    const answerMatch = line.match(/^(?:正确)?答案\s*[：:]?\s*([A-E](?:\s*[,，、\s]\s*[A-E]){0,4})\s*$/i);
    if (answerMatch) {
      answers = (answerMatch[1].toUpperCase().match(/[A-E]/g) || []) as ParsedLetter[];
      section = 'answer'; currentOption = null;
      continue;
    }

    const inlineOption = line.match(/^([A-E])(?:[.．、:：)）]\s*|\s+)(.+)$/i);
    const standaloneOption = line.match(/^([A-E])[.．、:：)）]?$/i);
    if (inlineOption || standaloneOption) {
      currentOption = (inlineOption?.[1] || standaloneOption?.[1]).toUpperCase() as ParsedLetter;
      section = 'options';
      if (inlineOption?.[2]) options[currentOption] = inlineOption[2];
      continue;
    }

    if (/^(?:答案|答题结果|查看答案)$/.test(line) || /^(?:回答(?:正确|错误)|得分)[:：]?.*$/.test(line) || /^你的答案\s*[：:].*$/.test(line)) {
      currentOption = null;
      if (section === 'options') section = 'answer';
      continue;
    }

    if (section === 'explanation') explanationLines.push(line);
    else if (section === 'options' && currentOption) options[currentOption] += `${options[currentOption] ? '\n' : ''}${line}`;
    else if (section === 'question') questionLines.push(line);
  }

  const optionCount = Object.values(options).filter(Boolean).length;
  const type = explicitType || (optionCount === 5 || answers.length > 1 ? 'multiple' : 'single');
  return {
    type,
    prompt: questionLines.join('\n').trim(),
    options,
    answers: [...new Set(answers)].sort(),
    explanation: explanationLines.join('\n').trim(),
    optionCount,
  };
}
