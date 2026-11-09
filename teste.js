// node teste.js — confere o equilíbrio do dados.js e as regras de pontuação do jogo
const assert = require('assert');
global.window = global;
require('./dados.js');
const Quiz = require('./jogo.js');
const D = window.DADOS;

assert.deepStrictEqual(Quiz.validar(D), [], 'dados.js desequilibrado');

const roteiro = Quiz.roteiro(D);
assert.strictEqual(roteiro.filter(p => p.n).length, 16, 'precisam ser 16 perguntas');
assert.strictEqual(roteiro.filter(p => p.tipo === 'intro').length, 3, '2 fases + rodada relâmpago');

// quem escolhe sempre o mesmo perfil termina com ele, sem empate
for (const perfil of Quiz.PERFIS) {
  const respostas = roteiro.map(p => p.ops && (p.ops.find(([k]) => k === perfil) || p.ops[0])[0]);
  const c = Quiz.contar(respostas);
  assert.deepStrictEqual(Quiz.empatados(c), [perfil], `aluno ${perfil} deveria vencer sozinho`);
}

// porcentagens sempre somam 100
for (let i = 0; i < 1000; i++) {
  const c = Object.fromEntries(Quiz.PERFIS.map(p => [p, Math.floor(Math.random() * 12)]));
  if (Object.values(c).every(v => v === 0)) continue;
  const soma = Object.values(Quiz.porcentagens(c)).reduce((a, b) => a + b, 0);
  assert.strictEqual(soma, 100, JSON.stringify(c));
}

assert.deepStrictEqual(Quiz.empatados({ criativo: 5, estrategista: 5, conector: 3, executor: 3 }), ['criativo', 'estrategista']);
console.log('ok: dados equilibrados, perfis puros vencem, porcentagens somam 100, empate detectado');
