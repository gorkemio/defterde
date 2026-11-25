(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? { ...require('./board.js'), ...require('./solver.js') } : root.Kakuro);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Kakuro, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';
  const techniqueNames = {
    single: 'Tek aday', remainder: 'Kalan toplam', combination: 'Toplam kombinasyonları',
    given: 'Verilmiş rakamı eleme', filtered: 'Kombinasyon eleme', hidden: 'Zorunlu rakamın tek yeri',
    subset: 'Açık ikili / üçlü', support: 'Hücre bazında yerleşim desteği'
  };
  function createAnalysis(board, values = Array(board.cells.length).fill(0)) {
    return { values: [...values], candidates: values.map((v, i) => board.membership[i] ? v ? K.bit(v) : K.ALL : 0) };
  }
  function reduction(analysis, group, masks, technique, level, evidence = {}) {
    const changes = group.cells.map((cell, j) => ({
      cell, before: analysis.candidates[cell], after: analysis.candidates[cell] & masks[j]
    })).filter(c => c.before !== c.after);
    if (!changes.length) return null;
    if (changes.some(c => !c.after)) return { kind: 'contradiction', groups: [group.id], message: 'Bu grubun hücreleri için geçerli yerleşim kalmadı.' };
    return { kind: 'elimination', technique, level, groups: [group.id], cells: group.cells, changes, evidence };
  }
  const possibleCombos = (group, analysis, filtered) => {
    let given = 0;
    for (const cell of group.cells) if (analysis.values[cell]) given |= K.bit(analysis.values[cell]);
    return K.combinations[group.cells.length][group.total].filter(combo => {
      if ((combo & given) !== given) return false;
      if (!filtered) return true;
      const masks = group.cells.map(i => analysis.candidates[i] & combo);
      return masks.every(Boolean) && masks.reduce((a,b)=>a|b,0) === combo;
    });
  };
  function* logicalStepSteps(board, analysis, maxLevel = 3, checkpoint = () => {}) {
    const validity = K.validateValues(board, analysis.values);
    if (!validity.valid) return { kind: 'contradiction', groups: [...new Set(validity.issues.flatMap(i=>i.groups))], message: validity.issues[0].message };
    if (validity.complete) return { kind: 'complete' };
    for (const cell of board.white) {
      if (!analysis.candidates[cell]) return { kind: 'contradiction', groups: Object.values(board.membership[cell]), message: 'Bu kare için aday kalmadı.' };
      if (!analysis.values[cell] && K.popcount(analysis.candidates[cell]) === 1)
        return { kind: 'placement', technique: 'single', level: 1, groups: Object.values(board.membership[cell]),
          cells: [cell], changes: [], placement: { cell, value: K.digits(analysis.candidates[cell])[0] }, evidence: { mask: analysis.candidates[cell] } };
    }
    for (const g of board.groups) {
      checkpoint(); yield null;
      const empty = g.cells.filter(i => !analysis.values[i]);
      if (empty.length === 1) {
        const value = g.total - g.cells.reduce((sum,i)=>sum+analysis.values[i],0), cell = empty[0];
        if (!(analysis.candidates[cell] & K.bit(value))) return { kind: 'contradiction', groups: [g.id], message: 'Kalan toplam adaylarla çelişiyor.' };
        return { kind: 'placement', technique: 'remainder', level: 1, groups: [g.id], cells: g.cells,
          changes: [{ cell, before: analysis.candidates[cell], after: K.bit(value) }], placement: { cell, value }, evidence: { total: g.total } };
      }
      let used = 0;
      g.cells.forEach(i => { if (analysis.values[i]) used |= K.bit(analysis.values[i]); });
      const given = reduction(analysis, g, g.cells.map(i=>analysis.values[i] ? K.bit(analysis.values[i]) : K.ALL & ~used), 'given', 1, { used });
      if (given) return given;
      const combos = possibleCombos(g, analysis, false);
      const union = combos.reduce((a,b)=>a|b,0);
      const basic = reduction(analysis, g, g.cells.map(()=>union), 'combination', 1, { combinations: combos, total: g.total });
      if (basic) return basic;
    }
    if (maxLevel >= 2) for (const g of board.groups) {
      checkpoint(); yield null;
      const combos = possibleCombos(g, analysis, true);
      if (!combos.length) return { kind: 'contradiction', groups: [g.id], message: 'Bu grubun adaylarına uyan toplam kombinasyonu yok.' };
      const union = combos.reduce((a,b)=>a|b,0);
      const filtered = reduction(analysis, g, g.cells.map(()=>union), 'filtered', 2, { combinations: combos });
      if (filtered) return filtered;
      const mandatory = combos.reduce((a,b)=>a&b,K.ALL);
      for (const n of K.digits(mandatory)) {
        const places = g.cells.filter(i=>analysis.candidates[i] & K.bit(n));
        if (places.length !== 1) continue;
        const masks = g.cells.map(i=>i===places[0] ? K.bit(n) : K.ALL);
        const hidden = reduction(analysis,g,masks,'hidden',2,{ mandatory: n, combinations: combos });
        if (hidden) return hidden;
      }
      const eligible = g.cells.filter(i=>!analysis.values[i] && K.popcount(analysis.candidates[i]) <= 3);
      for (let a=0;a<eligible.length;a++) for (let b=a+1;b<eligible.length;b++) {
        const sets = [[eligible[a],eligible[b]]];
        for (let c=b+1;c<eligible.length;c++) sets.push([eligible[a],eligible[b],eligible[c]]);
        for (const subset of sets) {
          const mask = subset.reduce((m,i)=>m|analysis.candidates[i],0);
          if (K.popcount(mask) !== subset.length) continue;
          const result = reduction(analysis,g,g.cells.map(i=>subset.includes(i) ? K.ALL : K.ALL & ~mask),'subset',2,{ subset, mask });
          if (result) return result;
        }
      }
    }
    if (maxLevel >= 3) for (const g of board.groups) {
      checkpoint(); yield null;
      const support = yield* K.supportSteps(g,analysis.candidates,checkpoint);
      if (!support.combinations.length) return { kind:'contradiction',groups:[g.id],message:'Rakamlar bu grubun hücrelerine tekrarsız yerleşemiyor.' };
      const result = reduction(analysis,g,support.support,'support',3,{
        combinations:support.combinations, constraints:g.cells.map(cell=>({cell,mask:analysis.candidates[cell]}))
      });
      if (result) return result;
    }
    return { kind:'stuck' };
  }
  const nextLogicalStep = (board, analysis, maxLevel = 3) => K.drain(logicalStepSteps(board,analysis,maxLevel));
  function applyLogicalStep(analysis, step) {
    for (const c of step.changes || []) {
      if (analysis.candidates[c.cell] !== c.before || !c.after || (c.after & c.before) !== c.after) throw new Error('Geçersiz veya eski mantık adımı.');
      analysis.candidates[c.cell] = c.after;
    }
    if (step.placement) {
      analysis.values[step.placement.cell] = step.placement.value;
      analysis.candidates[step.placement.cell] = K.bit(step.placement.value);
    }
    return analysis;
  }
  function solveLogically(board, maxLevel = 3) {
    const analysis = createAnalysis(board), trace = [], usage = {};
    for (let i=0;i<board.white.length*12+1;i++) {
      const step = nextLogicalStep(board,analysis,maxLevel);
      if (!['placement','elimination'].includes(step.kind)) return { status:step.kind,analysis,trace,usage,
        score:trace.reduce((sum,s)=>sum+[0,1,3,6][s.level],0)/board.white.length };
      trace.push(step); usage[step.technique]=(usage[step.technique]||0)+1; applyLogicalStep(analysis,step);
    }
    throw new Error('Mantık motoru adım sınırını aştı.');
  }
  function describeStep(board, step) {
    const cellName = i => `${Math.floor(i/board.cols)+1}. satır, ${i%board.cols+1}. sütun`;
    const groupName = g => `${Math.floor(g.clue/board.cols)+1}. satır ${g.clue%board.cols+1}. sütundaki ${g.axis==='across'?'yatay':'dikey'} ${g.total} grubu`;
    if (step.kind === 'contradiction') return { title:'Bir çelişki var', text:step.message,details:(step.groups||[]).map(id=>groupName(board.groups[id])) };
    if (step.kind === 'stuck') return { title:'Burada durduk',text:'Desteklenen mantık teknikleri yeni bir çıkarım bulamadı. Notlarını ve toplamları yeniden inceleyebilirsin.',details:[] };
    if (step.kind === 'complete') return { title:'Bütün toplamlar tamam',text:'Tüm gruplar kurallara uyuyor.',details:[] };
    const names = step.groups.map(id=>groupName(board.groups[id])).join(' ve ');
    const reasons = {
      single:'Yatay ve dikey gruplardan kalan adayların kesişiminde tek rakam var.',
      remainder:'Gruptaki yazılı rakamların toplamını ipucundan çıkarınca bu rakam kalır.',
      combination:'Bu uzunluk ve toplam için mümkün tekrarsız rakam kümelerini kullanıyoruz.',
      given:'Grupta yazılı olan rakam başka bir karede kullanılamaz.',
      filtered:'Her hücreye en az bir aday ve her rakama en az bir yer bırakan kombinasyonlar kalır.',
      hidden:'Bu rakam kalan bütün kombinasyonlarda zorunlu ve yalnız bir kareye yazılabilir.',
      subset:'İki veya üç karenin adayları aynı sayıda rakamı tamamen kapatır; bu rakamlar grubun diğer karelerinde olamaz.',
      support:'Her aday, diğer hücrelerin adaylarıyla birlikte denenir. Toplama uyan tekrarsız bir yerleşime katılamayan adaylar elenir.'
    };
    const details = (step.changes||[]).map(c=>`${cellName(c.cell)}: ${K.digits(c.before).join(', ')} → ${K.digits(c.after).join(', ')}.`);
    if(step.technique==='support') for(const change of step.changes) {
      for(const digit of K.digits(change.before & ~change.after))
        details.push(`${cellName(change.cell)} karesine ${digit} konulduğunda aşağıdaki hücre adaylarıyla hedef toplamı sağlayan tekrarsız bir yerleşim kurulamıyor.`);
    }
    if (step.evidence?.constraints) details.push(...step.evidence.constraints.map(c=>`${cellName(c.cell)} için başlangıç kısıtı: ${K.digits(c.mask).join(', ')}.`));
    if (step.evidence?.combinations) details.push(`Kalan kombinasyonlar: ${step.evidence.combinations.map(m=>K.digits(m).join('+')).join(' / ')}.`);
    return { title:techniqueNames[step.technique],text:`${reasons[step.technique]} Dayanak: ${names}.${step.placement ? ` ${cellName(step.placement.cell)} için ${step.placement.value} kesinleşti.`:''}`,details };
  }
  return { techniqueNames, createAnalysis, possibleCombos, logicalStepSteps, nextLogicalStep, applyLogicalStep, solveLogically, describeStep };
});
