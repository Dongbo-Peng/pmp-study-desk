'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2, CircleAlert,
  ClipboardPaste, Download, Flame, Home as HomeIcon, Library, Pencil, Plus, RotateCcw,
  Save, Target, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { parsePastedQuestion } from '@/lib/question-parser';

type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
type Question = {
  id: string; type: 'single' | 'multiple'; prompt: string;
  options: Partial<Record<Letter, string>>; answers: Letter[]; explanation: string;
  attempts: number; wrongCount: number; mastered: boolean; createdAt: number;
};
type View = 'home' | 'add' | 'bank' | 'practice';
type PracticeMode = 'all' | 'wrong' | 'hard';

const STORAGE_KEY = 'pmp-study-desk-v1';
const demoQuestions: Question[] = [
  { id: 'demo-1', type: 'single', prompt: '一个关键相关方对项目的新交付成果表示担忧。项目经理下一步应该怎么做？', options: { A: '立即更新项目进度计划', B: '查阅相关方参与计划并与其沟通', C: '要求发起人解决该问题', D: '将该相关方从沟通名单中移除' }, answers: ['B'], explanation: '项目经理应先依据相关方参与计划了解其期望与参与策略，并通过沟通澄清担忧，而不是直接升级或变更计划。', attempts: 0, wrongCount: 0, mastered: false, createdAt: 1 },
  { id: 'demo-2', type: 'multiple', prompt: '在敏捷项目中，团队希望持续提高交付质量。项目经理应该采取哪些行动？（选择两项）', options: { A: '在每次迭代结束后开展回顾', B: '将全部测试留到项目结束时进行', C: '鼓励团队识别并消除流程障碍', D: '由项目经理单独决定改进措施', E: '冻结产品待办事项' }, answers: ['A', 'C'], explanation: '回顾会议用于持续改进，团队共同识别和消除障碍能提升过程与质量。集中测试、单方面决策和冻结待办事项都不符合敏捷原则。', attempts: 0, wrongCount: 0, mastered: false, createdAt: 2 },
  { id: 'demo-3', type: 'multiple', prompt: '项目进入执行阶段后发生重大组织变更。为妥善应对，项目经理应该关注哪些方面？（选择三项）', options: { A: '重新评估相关方', B: '评估对项目目标的影响', C: '更新相关项目文件', D: '忽略变更直到下次阶段评审', E: '停止所有沟通' }, answers: ['A', 'B', 'C'], explanation: '组织变更可能改变相关方、权力关系和项目约束，应重新评估相关方、分析影响，并更新项目文件。', attempts: 0, wrongCount: 0, mastered: false, createdAt: 3 },
];

const blankOptions = (): Record<Letter, string> => ({ A: '', B: '', C: '', D: '', E: '' });
const sortLetters = (letters: Letter[]) => [...letters].sort();
const sameAnswers = (a: Letter[], b: Letter[]) => JSON.stringify(sortLetters(a)) === JSON.stringify(sortLetters(b));
const allowedLetters = (type: Question['type']): Letter[] => type === 'single' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

function normalizeQuestion(question: Question): Question {
  const letters = allowedLetters(question.type);
  const options = Object.fromEntries(
    letters.map((letter) => [letter, question.options?.[letter] || '']),
  ) as Partial<Record<Letter, string>>;
  return {
    ...question,
    options,
    answers: question.answers.filter((answer) => letters.includes(answer)),
  };
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>(demoQuestions);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('home');
  const [mode, setMode] = useState<PracticeMode>('all');
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Array.isArray(data.questions)) setQuestions(data.questions.map(normalizeQuestion));
        if (data.session?.queue?.length) { setQueue(data.session.queue); setIndex(data.session.index || 0); setMode(data.session.mode || 'all'); }
      } catch { /* keep demo data */ }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ questions, session: { queue, index, mode } }));
  }, [questions, queue, index, mode, ready]);

  const stats = useMemo(() => {
    const attempts = questions.reduce((sum, q) => sum + q.attempts, 0);
    const wrong = questions.reduce((sum, q) => sum + q.wrongCount, 0);
    const pending = questions.filter((q) => q.wrongCount > 0 && !q.mastered).length;
    return { attempts, accuracy: attempts ? Math.round(((attempts - wrong) / attempts) * 100) : 0, pending };
  }, [questions]);

  function startPractice(nextMode: PracticeMode, resume = false) {
    let ids: string[];
    if (resume && queue.length && index < queue.length) ids = queue;
    else if (nextMode === 'wrong') ids = questions.filter((q) => q.wrongCount > 0 && !q.mastered).map((q) => q.id);
    else if (nextMode === 'hard') ids = [...questions].filter((q) => q.wrongCount > 0).sort((a, b) => b.wrongCount - a.wrongCount).map((q) => q.id);
    else ids = questions.map((q) => q.id);
    setMode(nextMode); setQueue(ids); if (!resume) setIndex(0); setView('practice');
  }

  function saveQuestion(question: Question) {
    const normalized = normalizeQuestion(question);
    setQuestions((items) => editingId ? items.map((q) => q.id === editingId ? normalized : q) : [...items, normalized]);
    setEditingId(null); setView('bank');
  }

  function replaceQuestions(raw: string) {
    const parsed = JSON.parse(raw);
    const imported = Array.isArray(parsed) ? parsed : parsed?.questions;
    if (!Array.isArray(imported) || imported.length === 0) throw new Error('备份中没有题目');
    const valid = imported.filter((q) =>
      (q?.type === 'single' || q?.type === 'multiple') &&
      typeof q.prompt === 'string' && q.options && Array.isArray(q.answers) && typeof q.explanation === 'string',
    ).map((q, i) => normalizeQuestion({
      ...q,
      id: typeof q.id === 'string' ? q.id : `imported-${Date.now()}-${i}`,
      attempts: Number.isFinite(q.attempts) ? q.attempts : 0,
      wrongCount: Number.isFinite(q.wrongCount) ? q.wrongCount : 0,
      mastered: Boolean(q.mastered),
      createdAt: Number.isFinite(q.createdAt) ? q.createdAt : Date.now() + i,
    }));
    if (!valid.length) throw new Error('备份格式不正确');
    setQuestions(valid); setQueue([]); setIndex(0);
    return valid.length;
  }

  function finishAnswer(id: string, correct: boolean) {
    setQuestions((items) => items.map((q) => q.id !== id ? q : {
      ...q, attempts: q.attempts + 1, wrongCount: q.wrongCount + (correct ? 0 : 1),
      mastered: correct && (mode === 'wrong' || q.wrongCount > 0) ? true : correct ? q.mastered : false,
    }));
  }

  const current = questions.find((q) => q.id === queue[index]);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader view={view} setView={setView} onAdd={() => { setEditingId(null); setView('add'); }} />
      {view === 'home' && <Dashboard questions={questions} stats={stats} canResume={queue.length > 0 && index < queue.length} startPractice={startPractice} setView={setView} />}
      {view === 'add' && <QuestionForm initial={editingId ? questions.find((q) => q.id === editingId) : undefined} onSave={saveQuestion} onCancel={() => { setEditingId(null); setView('bank'); }} />}
      {view === 'bank' && <QuestionBank questions={questions} onAdd={() => { setEditingId(null); setView('add'); }} onEdit={(id) => { setEditingId(id); setView('add'); }} onDelete={(id) => setQuestions((items) => items.filter((q) => q.id !== id))} onReplace={replaceQuestions} />}
      {view === 'practice' && <Practice question={current} index={index} total={queue.length} mode={mode} onAnswer={finishAnswer} onNext={() => setIndex((i) => i + 1)} onExit={() => setView('home')} onRestartWrong={() => startPractice('wrong')} />}
      <footer className="mx-auto max-w-7xl px-5 pb-8 pt-3 text-center text-xs text-muted-foreground sm:px-8">题库与进度仅保存在当前浏览器 · 请勿在无痕模式中长期使用</footer>
    </main>
  );
}

function AppHeader({ view, setView, onAdd }: { view: View; setView: (v: View) => void; onAdd: () => void }) {
  const nav = [{ id: 'home' as View, label: '学习概览', icon: HomeIcon }, { id: 'bank' as View, label: '我的题库', icon: Library }];
  return <header className="sticky top-0 z-20 border-b border-border/70 bg-card/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 sm:px-8"><button onClick={() => setView('home')} className="mr-auto flex items-center gap-3 text-left"><span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><BookOpenCheck className="size-5" /></span><div className="hidden sm:block"><p className="font-bold tracking-tight">PMP 学习台</p><p className="text-[11px] text-muted-foreground">把错题练成得分题</p></div></button><nav className="flex items-center gap-1">{nav.map(({ id, label, icon: Icon }) => <Button key={id} variant={view === id ? 'secondary' : 'ghost'} onClick={() => setView(id)}><Icon className="size-4" /><span className="hidden sm:inline">{label}</span></Button>)}</nav><Button onClick={onAdd}><Plus className="size-4" /><span className="hidden sm:inline">录入新题</span></Button></div></header>;
}

function Dashboard({ questions, stats, canResume, startPractice, setView }: { questions: Question[]; stats: { attempts: number; accuracy: number; pending: number }; canResume: boolean; startPractice: (m: PracticeMode, r?: boolean) => void; setView: (v: View) => void }) {
  return <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><span className="eyebrow">学习概览</span><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">今天，再攻克一组题</h1><p className="mt-2 text-muted-foreground">每次提交后立即查看答案和解析，让知识点记得更牢。</p></div>{canResume && <Button variant="outline" size="lg" onClick={() => startPractice('all', true)}><RotateCcw />继续上次练习</Button>}</div>
    <div className="grid gap-5 lg:grid-cols-[1.45fr_.8fr]"><article className="rounded-[28px] border bg-card p-6 shadow-[0_18px_60px_-36px_rgba(25,67,57,.35)] sm:p-8"><div className="rounded-[22px] border border-primary/15 bg-primary/[.045] p-5 sm:p-6"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Target /></span><div><p className="text-sm font-semibold text-primary">推荐练习</p><h2 className="mt-1 text-xl font-bold">优先练习最容易出错的题目</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">按错误次数从高到低排列，集中突破薄弱点。</p></div></div><Button size="lg" className="mt-6 min-h-11 w-full sm:w-auto" disabled={!stats.pending} onClick={() => startPractice('hard')}><Flame />开始高频错题练习</Button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => startPractice('all')} disabled={!questions.length} className="action-card"><span className="icon-chip"><BookOpenCheck /></span><span><strong>全部题目</strong><small>{questions.length} 道题，顺序练习</small></span><ArrowRight /></button><button onClick={() => startPractice('wrong')} disabled={!stats.pending} className="action-card"><span className="icon-chip warm"><CircleAlert /></span><span><strong>只做错题</strong><small>{stats.pending} 道待攻克</small></span><ArrowRight /></button></div></article>
      <aside className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1"><Stat icon={<Library />} value={questions.length} label="题库题目" /><Stat icon={<Target />} value={stats.pending} label="待攻克错题" warm /><Stat icon={<CheckCircle2 />} value={`${stats.accuracy}%`} label={`${stats.attempts} 次作答的正确率`} /><Button variant="outline" className="min-h-11 sm:col-span-3 lg:col-span-1" onClick={() => setView('bank')}>管理我的题库</Button></aside></div></section>;
}

function Stat({ icon, value, label, warm }: { icon: React.ReactNode; value: string | number; label: string; warm?: boolean }) { return <div className="rounded-[22px] border bg-card p-5"><span className={`mb-5 grid size-9 place-items-center rounded-xl ${warm ? 'bg-amber-100 text-amber-700' : 'bg-secondary text-primary'}`}>{icon}</span><p className="text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div>; }

function QuestionForm({ initial, onSave, onCancel }: { initial?: Question; onSave: (q: Question) => void; onCancel: () => void }) {
  const [type, setType] = useState<'single' | 'multiple'>(initial?.type || 'single');
  const [prompt, setPrompt] = useState(initial?.prompt || '');
  const [options, setOptions] = useState<Record<Letter, string>>({ ...blankOptions(), ...initial?.options });
  const [answers, setAnswers] = useState<Letter[]>(initial?.answers || []);
  const [explanation, setExplanation] = useState(initial?.explanation || '');
  const [bulk, setBulk] = useState('');
  const [message, setMessage] = useState('');
  const letters: Letter[] = type === 'single' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  function switchType(next: 'single' | 'multiple') { setType(next); setAnswers([]); setMessage(''); }
  function toggleAnswer(letter: Letter) { setAnswers((now) => type === 'single' ? [letter] : now.includes(letter) ? now.filter((x) => x !== letter) : now.length < 3 ? [...now, letter] : now); }
  function parseBulk() {
    const parsed = parsePastedQuestion(bulk);
    setType(parsed.type); setPrompt(parsed.prompt); setOptions(parsed.options); setAnswers(parsed.answers); setExplanation(parsed.explanation);
    const expectedOptions = parsed.type === 'single' ? 4 : 5;
    const complete = parsed.prompt && parsed.optionCount === expectedOptions && parsed.answers.length > 0 && parsed.explanation;
    setMessage(complete ? `识别成功：${parsed.type === 'single' ? '单选题' : '多选题'}、${parsed.optionCount} 个选项、答案 ${parsed.answers.join('、')}，请检查后保存。` : `已识别题干、${parsed.optionCount} 个选项和${parsed.answers.length ? `答案 ${parsed.answers.join('、')}` : '答案未识别'}；请检查缺失内容。`);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); const required = type === 'single' ? 4 : 5; const validAnswerCount = type === 'single' ? answers.length === 1 : answers.length === 2 || answers.length === 3;
    if (!prompt.trim() || letters.some((l) => !options[l].trim()) || !validAnswerCount || !explanation.trim()) { setMessage(`请完整填写题目、${required} 个选项、正确答案和解析。`); return; }
    const cleanOptions = Object.fromEntries(letters.map((letter) => [letter, options[letter].trim()])) as Partial<Record<Letter, string>>;
    onSave({ id: initial?.id || crypto.randomUUID(), type, prompt: prompt.trim(), options: cleanOptions, answers: sortLetters(answers), explanation: explanation.trim(), attempts: initial?.attempts || 0, wrongCount: initial?.wrongCount || 0, mastered: initial?.mastered || false, createdAt: initial?.createdAt || Date.now() });
  }
  return <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-10"><button onClick={onCancel} className="mb-5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft />返回题库</button><div className="mb-7"><span className="eyebrow">{initial ? '编辑题目' : '添加题目'}</span><h1 className="mt-2 text-3xl font-bold tracking-tight">复制粘贴，快速建立题库</h1></div>
    {!initial && <div className="mb-6 rounded-[24px] border bg-card p-5 sm:p-6"><div className="flex items-start gap-3"><ClipboardPaste className="mt-1 text-primary" /><div className="flex-1"><h2 className="font-bold">智能粘贴整道题</h2><p className="mt-1 text-sm text-muted-foreground">可直接粘贴考试页面内容，支持选项字母和内容分行、正确答案、你的答案及解析等常见格式。</p><Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} className="mt-4 min-h-40 bg-background" placeholder={'单选题\n/1分\n项目经理首先应该做什么？\nA\n更新风险登记册\nB\n与团队沟通\nC\n上报发起人\nD\n忽略问题\n正确答案：B\n你的答案：D\n解析\n先沟通并了解实际情况。'} /><Button type="button" variant="secondary" className="mt-3" onClick={parseBulk}><ClipboardPaste />识别并填入</Button></div></div></div>}
    <form onSubmit={submit} className="rounded-[28px] border bg-card p-5 sm:p-8"><div className="mb-6"><label className="field-label">题型</label><div className="mt-2 grid max-w-md grid-cols-2 rounded-xl bg-muted p-1"><button type="button" onClick={() => switchType('single')} className={`type-tab ${type === 'single' ? 'active' : ''}`}>单选题 · 4项选1</button><button type="button" onClick={() => switchType('multiple')} className={`type-tab ${type === 'multiple' ? 'active' : ''}`}>多选题 · 5项选2/3</button></div></div><label className="field-label">题目</label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="mt-2 min-h-28" placeholder="粘贴题目正文" />
      <div className="mt-6 space-y-3"><label className="field-label">备选答案</label>{letters.map((letter) => <div key={letter} className="grid grid-cols-[46px_1fr] gap-3"><button type="button" aria-label={`设为正确答案 ${letter}`} onClick={() => toggleAnswer(letter)} className={`answer-key ${answers.includes(letter) ? 'selected' : ''}`}>{answers.includes(letter) ? <Check /> : letter}</button><Input value={options[letter]} onChange={(e) => setOptions({ ...options, [letter]: e.target.value })} className="h-11 bg-background" placeholder={`${letter} 选项内容`} /></div>)}</div>
      <p className="mt-3 text-xs text-muted-foreground">点击左侧字母标记正确答案。{type === 'multiple' && `当前选择 ${answers.length} 项，须选择 2 项或 3 项。`}</p><div className="mt-6"><label className="field-label">答案解析</label><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="mt-2 min-h-32" placeholder="粘贴答案解析，说明为什么正确以及其他选项的问题" /></div>{message && <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p>}<div className="mt-7 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onCancel}>取消</Button><Button type="submit" size="lg"><Save />保存题目</Button></div></form></section>;
}

function QuestionBank({ questions, onAdd, onEdit, onDelete, onReplace }: { questions: Question[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onReplace: (raw: string) => number }) {
  const [backup, setBackup] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  function downloadBackup() {
    const blob = new Blob([JSON.stringify({ questions }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `pmp题库备份-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function importBackup() {
    try { const count = onReplace(backup); setBackup(''); setBackupMessage(`已恢复 ${count} 道题。`); }
    catch { setBackupMessage('无法识别该备份，请确认粘贴了完整的题库备份内容。'); }
  }
  return <section className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-10"><div className="mb-7 flex items-end justify-between gap-4"><div><span className="eyebrow">我的题库</span><h1 className="mt-2 text-3xl font-bold tracking-tight">共 {questions.length} 道题</h1></div><Button onClick={onAdd}><Plus />继续录题</Button></div><details className="mb-5 rounded-[20px] border bg-card p-4"><summary className="cursor-pointer font-semibold">题库备份与迁移</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">题目仅保存在当前浏览器。建议定期下载备份；更换设备或网址时，可粘贴备份内容恢复。</p><div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" onClick={downloadBackup}><Download />下载题库备份</Button></div><Textarea aria-label="粘贴题库备份" value={backup} onChange={(e) => setBackup(e.target.value)} className="mt-4 min-h-28 bg-background" placeholder="在这里粘贴题库备份内容" /><Button className="mt-3" disabled={!backup.trim()} onClick={importBackup}><Upload />替换并恢复题库</Button>{backupMessage && <p className="mt-3 text-sm font-medium text-primary">{backupMessage}</p>}</details>{questions.length === 0 ? <div className="empty-state"><Library /><h2>题库还是空的</h2><p>添加第一道题，开始你的 PMP 学习。</p><Button onClick={onAdd}>录入新题</Button></div> : <div className="space-y-3">{questions.map((q, i) => <article key={q.id} className="rounded-[22px] border bg-card p-5"><div className="flex items-start gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-sm font-bold">{i + 1}</span><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="tag">{q.type === 'single' ? '单选题' : `多选题 · ${q.answers.length}项`}</span>{q.wrongCount > 0 && <span className="tag wrong">错过 {q.wrongCount} 次</span>}{q.mastered && <span className="tag mastered">已攻克</span>}</div><h2 className="line-clamp-2 font-semibold leading-7">{q.prompt}</h2><p className="mt-2 text-sm text-muted-foreground">正确答案：{q.answers.join('、')} · 已作答 {q.attempts} 次</p></div><div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label="编辑题目" onClick={() => onEdit(q.id)}><Pencil /></Button><Button size="icon" variant="ghost" aria-label="删除题目" onClick={() => { if (confirm('确定删除这道题吗？')) onDelete(q.id); }}><Trash2 /></Button></div></div></article>)}</div>}</section>;
}

function Practice({ question, index, total, mode, onAnswer, onNext, onExit, onRestartWrong }: { question?: Question; index: number; total: number; mode: PracticeMode; onAnswer: (id: string, correct: boolean) => void; onNext: () => void; onExit: () => void; onRestartWrong: () => void }) {
  const [selected, setSelected] = useState<Letter[]>([]); const [submitted, setSubmitted] = useState(false); const [correct, setCorrect] = useState(false);
  useEffect(() => { setSelected([]); setSubmitted(false); setCorrect(false); }, [question?.id]);
  if (!question) return <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><div className="empty-state"><CheckCircle2 className="text-primary" /><h1>{total ? '本轮练习完成' : '目前没有符合条件的题目'}</h1><p>{total ? '做得好！可以继续只做错题，直到全部攻克。' : '先去做一轮全部题目，错题会自动收集在这里。'}</p><div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={onExit}>返回概览</Button>{total > 0 && <Button onClick={onRestartWrong}>继续攻克错题</Button>}</div></div></section>;
  const letters = allowedLetters(question.type); const need = question.type === 'single' ? 1 : question.answers.length;
  function choose(letter: Letter) { if (submitted) return; setSelected((now) => question.type === 'single' ? [letter] : now.includes(letter) ? now.filter((x) => x !== letter) : now.length < need ? [...now, letter] : now); }
  function submit() { const ok = sameAnswers(selected, question.answers); setCorrect(ok); setSubmitted(true); onAnswer(question.id, ok); }
  return <section className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-10"><div className="mb-5 flex items-center justify-between"><button onClick={onExit} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><X />退出并保存</button><span className="text-sm font-semibold">{index + 1} / {total}</span></div><Progress value={total ? ((index + 1) / total) * 100 : 0} className="mb-6" />
    <article className="rounded-[28px] border bg-card p-5 shadow-[0_18px_60px_-40px_rgba(25,67,57,.35)] sm:p-8"><div className="mb-5 flex flex-wrap items-center gap-2"><span className="tag">{question.type === 'single' ? '单选题' : '多选题'}</span><span className="text-sm text-muted-foreground">{question.type === 'single' ? '请选择 1 项' : `请选择 ${need} 项`}</span>{mode === 'hard' && <span className="tag wrong"><Flame />高频错题</span>}</div><h1 className="text-xl font-bold leading-9 sm:text-2xl">{question.prompt}</h1><div className="mt-7 space-y-3">{letters.map((letter) => { const picked = selected.includes(letter); const isAnswer = question.answers.includes(letter); const state = submitted ? isAnswer ? 'correct' : picked ? 'incorrect' : '' : picked ? 'picked' : ''; return <button key={letter} disabled={submitted} onClick={() => choose(letter)} className={`option-row ${state}`}><span className="option-letter">{letter}</span><span className="flex-1 text-left">{question.options[letter]}</span>{submitted && isAnswer && <CheckCircle2 />}{submitted && picked && !isAnswer && <X />}</button>; })}</div>
      {!submitted ? <div className="mt-7 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">已选择 {selected.length} / {need} 项</p><Button size="lg" className="min-w-28" disabled={selected.length !== need} onClick={submit}>提交答案</Button></div> : <div className={`feedback ${correct ? 'success' : 'error'}`}><div className="flex items-center gap-3">{correct ? <CheckCircle2 /> : <CircleAlert />}<div><p className="font-bold">{correct ? '回答正确' : `回答有误，正确答案是 ${question.answers.join('、')}`}</p><p className="mt-1 text-sm opacity-80">{correct && question.wrongCount > 0 ? '这道错题已被标记为“已攻克”。' : '查看解析，加深理解。'}</p></div></div><div className="mt-5 border-t border-current/10 pt-5"><p className="text-xs font-bold uppercase tracking-[.15em] opacity-65">答案解析</p><p className="mt-2 whitespace-pre-line leading-7">{question.explanation}</p></div><Button className="mt-6 w-full sm:w-auto" onClick={onNext}>{index + 1 < total ? '下一题' : '查看练习结果'}<ArrowRight /></Button></div>}
    </article></section>;
}
