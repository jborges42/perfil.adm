/* Qual é o seu perfil ADM? — jogo de cartas do ADM Experience · Técnico em Administração · EEB Eurico Pinz
   Lógica do jogo. Os textos e perguntas ficam em dados.js. */
(function () {
  'use strict';

  const PERFIS = ['criativo', 'estrategista', 'conector', 'executor'];
  const SIGLA = { criativo: 'CRI', estrategista: 'EST', conector: 'CON', executor: 'EXE' };

  // ---------- regras puras (verificadas por teste.js) ----------
  const Quiz = {
    PERFIS,

    contar(respostas) {
      const c = { criativo: 0, estrategista: 0, conector: 0, executor: 0 };
      for (const p of respostas) if (p) c[p]++;
      return c;
    },

    empatados(c) {
      const max = Math.max(...PERFIS.map(p => c[p]));
      return PERFIS.filter(p => c[p] === max);
    },

    ranking(c) {
      return PERFIS.slice().sort((a, b) => c[b] - c[a]);
    },

    // maiores restos: as porcentagens sempre somam 100
    porcentagens(c) {
      const total = PERFIS.reduce((s, p) => s + c[p], 0) || 1;
      const linhas = PERFIS.map(p => ({ p, v: (c[p] * 100) / total }));
      linhas.forEach(l => { l.f = Math.floor(l.v); });
      let resto = 100 - linhas.reduce((s, l) => s + l.f, 0);
      linhas.slice().sort((a, b) => (b.v - b.f) - (a.v - a.f)).forEach(l => { if (resto > 0) { l.f++; resto--; } });
      return Object.fromEntries(linhas.map(l => [l.p, l.f]));
    },

    embaralhar(lista, rnd = Math.random) {
      const a = lista.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    // sequência de telas: fases, rodada relâmpago depois da fase indicada
    roteiro(D, rnd = Math.random) {
      const passos = [];
      let n = 0;
      const pergunta = (tipo, q) => passos.push({ tipo, q, n: ++n, ops: Quiz.embaralhar(Object.entries(q.opcoes), rnd) });
      D.capitulos.forEach((cap, k) => {
        passos.push({ tipo: 'intro', rotulo: `${D.textos.capitulo} ${k + 1}`, titulo: cap.titulo, texto: cap.intro });
        cap.perguntas.forEach(q => pergunta('cenario', q));
        if (k + 1 === D.relampago.depoisDoCapitulo) {
          passos.push({ tipo: 'intro', relampago: true, rotulo: D.relampago.rotulo, titulo: D.relampago.titulo, texto: D.relampago.intro });
          D.relampago.perguntas.forEach(q => pergunta('vs', q));
        }
      });
      return passos;
    },

    // avisa no console se alguém editar dados.js e desequilibrar o jogo
    validar(D) {
      const erros = [];
      const vezes = { criativo: 0, estrategista: 0, conector: 0, executor: 0 };
      const pares = new Set();
      D.capitulos.forEach((cap, k) => cap.perguntas.forEach((q, i) => {
        const ps = Object.keys(q.opcoes).sort().join();
        if (ps !== 'conector,criativo,estrategista,executor') erros.push(`Fase ${k + 1}, pergunta ${i + 1}: precisa de 1 opção de cada perfil`);
        Object.keys(q.opcoes).forEach(p => { if (p in vezes) vezes[p]++; });
      }));
      D.relampago.perguntas.forEach((q, i) => {
        const ps = Object.keys(q.opcoes);
        if (ps.length !== 2 || ps.some(p => !(p in vezes))) erros.push(`Relâmpago ${i + 1}: precisa de 2 opções de perfis diferentes`);
        ps.forEach(p => { if (p in vezes) vezes[p]++; });
        pares.add(ps.sort().join('×'));
      });
      if (new Set(Object.values(vezes)).size > 1) erros.push(`Perfis aparecem quantidades diferentes de vezes: ${JSON.stringify(vezes)}`);
      if (pares.size !== D.relampago.perguntas.length) erros.push('Relâmpago repete algum par de perfis');
      if (Object.keys(D.desempate.opcoes).sort().join() !== 'conector,criativo,estrategista,executor') erros.push('Desempate precisa de 1 opção de cada perfil');
      PERFIS.forEach(p => { if (!D.perfis[p]) erros.push(`Falta o perfil ${p}`); });
      return erros;
    },
  };

  if (typeof module !== 'undefined') module.exports = Quiz;
  if (typeof document === 'undefined') return;

  // ---------- interface ----------
  const D = window.DADOS;
  const T = D.textos;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tempo = ms => (reduzido ? Math.min(ms, 150) : ms);
  const problemas = Quiz.validar(D);
  if (problemas.length) console.warn('[dados.js]', problemas);

  // arte dos perfis; enquanto avatar/emblema não existir, usa o ícone do perfil
  const RESERVA = {
    criativo: 'assets/icones/perfis/criativo-megaphone-fill.svg',
    estrategista: 'assets/icones/perfis/estrategista-binoculars-fill.svg',
    conector: 'assets/icones/perfis/conector-chats-circle-fill.svg',
    executor: 'assets/icones/perfis/executor-hammer-fill.svg',
  };
  function arte(img, perfil, pasta) {
    img.onerror = () => { img.onerror = null; img.src = RESERVA[perfil]; };
    img.src = `assets/${pasta}/${perfil}.svg`;
  }

  function criarCarta(perfil) {
    const el = $('#tpl-carta').content.firstElementChild.cloneNode(true);
    el.dataset.perfil = perfil;
    arte($('.cp-avatar', el), perfil, 'avatares');
    arte($('.cp-emblema', el), perfil, 'emblemas');
    $('.cp-perfil', el).textContent = D.perfis[perfil].nome;
    $('.cp-sigla', el).textContent = SIGLA[perfil];
    return el;
  }

  let passos = [];
  let idx = 0;
  let respostas = [];
  let nome = '';
  let travado = false;
  let timer = 0;
  let giro = 0;

  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = T[el.dataset.t]; });
  document.querySelectorAll('[data-t-label]').forEach(el => { el.setAttribute('aria-label', T[el.dataset.tLabel]); });
  $('#campo-nome').placeholder = T.name_placeholder;
  $('.previa-nome').textContent = T.previa_vazio;

  // tela inicial: as 4 cartas de perfil se revezando na mesa
  const posLeque = [0, 1, 2, 3];
  $('.leque').replaceChildren(...PERFIS.map((p, k) => {
    const el = criarCarta(p);
    el.classList.add('mini-carta', `pos-${k}`);
    el.style.setProperty('--k', k);
    return el;
  }));
  function girarLeque() {
    const prox = { 0: 1, 1: 3, 3: 2, 2: 0 };
    $$('.leque .carta-perfil').forEach((el, k) => {
      el.classList.remove(`pos-${posLeque[k]}`);
      posLeque[k] = prox[posLeque[k]];
      el.classList.add(`pos-${posLeque[k]}`);
    });
  }

  function mostrar(id) {
    clearTimeout(timer);
    clearInterval(giro);
    if (id === 'inicio' && !reduzido) giro = setInterval(girarLeque, 3400);
    document.querySelectorAll('.tela').forEach(t => t.classList.toggle('ativa', t.id === id));
    document.body.dataset.tela = id;
    window.scrollTo(0, 0);
  }

  // reinicia as animações de entrada quando a mesma tela é reaproveitada
  function reanimar(el) {
    el.classList.remove('anima');
    void el.offsetWidth;
    el.classList.add('anima');
  }

  function atualizarMonte() {
    const total = passos.filter(p => p.n).length;
    const feitas = Math.min(total, respostas.filter((r, i) => r && passos[i] && passos[i].n).length);
    const monte = $('.monte');
    monte.setAttribute('aria-valuenow', feitas);
    monte.setAttribute('aria-valuemax', total);
    $('.monte-n').textContent = feitas;
    $('.monte-total').textContent = `/${total}`;
    $('#btn-voltar').hidden = !passos.slice(0, idx).some(p => p.ops);
  }

  function renderPasso() {
    atualizarMonte();
    const p = passos[idx];
    if (p.tipo === 'intro') return renderIntro(p);
    renderPergunta(p);
  }

  function renderIntro(p) {
    const sec = $('#intro');
    sec.classList.toggle('relampago', !!p.relampago);
    $('.intro-rotulo', sec).textContent = p.rotulo;
    $('.intro-titulo', sec).textContent = p.titulo;
    $('.intro-texto', sec).textContent = p.texto;
    reanimar(sec);
    mostrar('intro');
    $('.intro-seguir', sec).focus({ preventScroll: true });
    const ms = p.relampago ? 4500 : 3500;
    sec.style.setProperty('--tempo', `${ms}ms`);
    timer = setTimeout(proximo, ms);
  }

  function renderPergunta(p) {
    const vs = p.tipo === 'vs';
    const sec = vs ? $('#vs') : $('#pergunta');
    $('.etiqueta', sec).textContent = p.tipo === 'desempate' ? T.tie_title : vs ? D.relampago.rotulo : p.q.etiqueta;
    $('.enunciado', sec).textContent = p.q.texto;
    const aviso = $('.intro-desempate', sec);
    if (aviso) aviso.hidden = p.tipo !== 'desempate';
    const mesa = vs ? $('.duelo', sec) : $('.mao', sec);
    const cartas = p.ops.map(([perfil, texto], k) => cartaOpcao(perfil, texto, 'ABCD'[k], k));
    if (vs) {
      const ou = document.createElement('span');
      ou.className = 'ou';
      ou.setAttribute('aria-hidden', 'true');
      ou.textContent = T.ou;
      cartas.splice(1, 0, ou);
    }
    mesa.replaceChildren(...cartas);
    mesa.classList.remove('respondida');
    reanimar(sec);
    mostrar(sec.id);
    $('.enunciado', sec).focus({ preventScroll: true });
  }

  function canto(classe, letra) {
    const s = document.createElement('span');
    s.className = `canto ${classe}`;
    s.setAttribute('aria-hidden', 'true');
    s.textContent = letra;
    const naipe = document.createElement('img');
    naipe.src = 'assets/marca/curso-simbolo.webp';
    naipe.alt = '';
    s.append(naipe);
    return s;
  }

  function cartaOpcao(perfil, texto, letra, k) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carta opcao';
    b.style.setProperty('--i', k);
    const t = document.createElement('span');
    t.className = 'opcao-texto';
    t.textContent = texto;
    b.append(canto('canto-a', letra), t, canto('canto-b', letra));
    b.addEventListener('click', () => escolher(b, perfil));
    return b;
  }

  function escolher(carta, perfil) {
    if (travado) return;
    travado = true;
    respostas[idx] = perfil;
    const alvo = $('.monte-pilha').getBoundingClientRect();
    const r = carta.getBoundingClientRect();
    carta.style.setProperty('--tx', `${alvo.left + alvo.width / 2 - (r.left + r.width / 2)}px`);
    carta.style.setProperty('--ty', `${alvo.top + alvo.height / 2 - (r.top + r.height / 2)}px`);
    carta.classList.add('jogada');
    carta.parentElement.classList.add('respondida');
    som('carta');
    setTimeout(() => {
      atualizarMonte();
      const monte = $('.monte');
      monte.classList.remove('bump');
      void monte.offsetWidth;
      monte.classList.add('bump');
    }, tempo(560));
    setTimeout(() => { travado = false; proximo(); }, tempo(780));
  }

  function proximo() {
    clearTimeout(timer);
    if (idx + 1 < passos.length) { idx++; return renderPasso(); }
    concluir();
  }

  function voltar() {
    if (travado) return;
    if (passos[idx] && passos[idx].tipo === 'desempate') passos.pop();
    let n = idx - 1;
    while (n >= 0 && !passos[n].ops) n--;
    if (n < 0) return;
    respostas.length = n;
    idx = n;
    renderPasso();
  }

  function concluir() {
    const c = Quiz.contar(respostas);
    const empate = Quiz.empatados(c);
    if (empate.length > 1) {
      passos.push({
        tipo: 'desempate',
        q: D.desempate,
        ops: Quiz.embaralhar(Object.entries(D.desempate.opcoes).filter(([p]) => empate.includes(p))),
      });
      idx++;
      return renderPasso();
    }
    abrirPacote(c);
  }

  // ---------- pacote: embaralha, abre e revela a carta ----------
  function abrirPacote(c) {
    const sec = $('#pacote');
    const pacote = $('.pacote', sec);
    const titulo = $('.pacote-titulo', sec);
    const dica = $('.pacote-dica', sec);
    let aberto = false;
    pacote.classList.remove('aberto');
    pacote.classList.add('chacoalhando');
    pacote.disabled = true;
    titulo.textContent = T.pacote_embaralhando;
    dica.hidden = true;
    reanimar(sec);
    mostrar('pacote');

    const abrir = () => {
      if (aberto) return;
      aberto = true;
      clearTimeout(timer);
      pacote.disabled = true;
      dica.hidden = true;
      pacote.classList.add('aberto');
      som('rasgar');
      timer = setTimeout(() => resultado(c), tempo(1250));
    };
    pacote.onclick = abrir;
    timer = setTimeout(() => {
      pacote.classList.remove('chacoalhando');
      pacote.disabled = false;
      titulo.textContent = T.pacote_titulo;
      dica.hidden = false;
      pacote.focus({ preventScroll: true });
      timer = setTimeout(abrir, 3500);
    }, tempo(1500));
  }

  function resultado(c) {
    const rank = Quiz.ranking(c);
    const [top, seg] = rank;
    const P = D.perfis[top];
    const pct = Quiz.porcentagens(c);
    document.body.dataset.perfil = top;

    const area = $('.carta-3d');
    const velha = $('.carta-perfil', area);
    if (velha) velha.remove();
    const carta = criarCarta(top);
    carta.classList.add('face-frente');
    carta.setAttribute('aria-label', `${T.carta_label} ${P.nome}`);
    $('.cp-jogador', carta).textContent = nome;
    $('.cp-sigla', carta).textContent = SIGLA[top];
    $('.cp-stats', carta).replaceChildren(...rank.map(p => {
      const li = document.createElement('li');
      li.dataset.perfil = p;
      if (p === top) li.className = 'topo';
      const b = document.createElement('b');
      b.textContent = pct[p];
      li.append(b, SIGLA[p]);
      return li;
    }));
    area.prepend(carta);
    contarAte($('.cp-num', carta), pct[top]);

    $('.res-nome').textContent = P.nome;
    $('.res-frase').textContent = P.frase;
    $('.res-descricao').textContent = P.descricao;
    lista('.res-fortes', P.pontosFortes);
    lista('.res-combina', P.combinaCom);
    lista('.res-profissoes', P.profissoes);
    $('.res-tecnico').textContent = P.noTecnico;
    $('.res-dica').textContent = P.dica;
    const temLadoB = c[seg] > 0;
    $('.bloco-lado-b').hidden = !temLadoB;
    if (temLadoB) $('.res-lado-b').textContent = D.perfis[seg].ladoB;

    reanimar($('#resultado'));
    mostrar('resultado');
    $('.res-nome').focus({ preventScroll: true });
    setTimeout(() => som('revelar'), tempo(1150));
  }

  function contarAte(el, alvo) {
    if (reduzido) { el.textContent = alvo; return; }
    const inicio = performance.now() + 900;
    const passo = agora => {
      const k = Math.min(1, Math.max(0, (agora - inicio) / 900));
      el.textContent = Math.round(alvo * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(passo);
    };
    el.textContent = '0';
    requestAnimationFrame(passo);
  }

  function lista(sel, itens) {
    $(sel).replaceChildren(...itens.map(txt => {
      const li = document.createElement('li');
      li.textContent = txt;
      return li;
    }));
  }

  // carta inclina acompanhando o mouse
  const areaCarta = $('.res-carta-area');
  areaCarta.addEventListener('pointermove', e => {
    if (reduzido || e.pointerType !== 'mouse') return;
    const r = areaCarta.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const c3 = $('.carta-3d');
    c3.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`);
    c3.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
  });
  areaCarta.addEventListener('pointerleave', () => {
    const c3 = $('.carta-3d');
    c3.style.removeProperty('--rx');
    c3.style.removeProperty('--ry');
  });

  function comecar() {
    passos = Quiz.roteiro(D);
    idx = 0;
    respostas = [];
    delete document.body.dataset.perfil;
    renderPasso();
  }

  function reiniciar() {
    nome = '';
    $('#campo-nome').value = '';
    $('.previa-nome').textContent = T.previa_vazio;
    delete document.body.dataset.perfil;
    reanimar($('#inicio'));
    mostrar('inicio');
  }

  // ---------- som (Web Audio, sem arquivos) ----------
  let audio = null;
  let somLigado = true;
  try { somLigado = localStorage.getItem('adm-som') !== 'off'; } catch (e) { /* sem storage: segue ligado */ }

  function nota(freq, ini, dur, tipo, vol, fim) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    const t = audio.currentTime + ini;
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  }

  // ruído filtrado: som de papel (carta, pacote rasgando)
  function papel(dur, freq, vol) {
    const n = Math.floor(audio.sampleRate * dur);
    const buf = audio.createBuffer(1, n, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const fonte = audio.createBufferSource();
    const filtro = audio.createBiquadFilter();
    const g = audio.createGain();
    fonte.buffer = buf;
    filtro.type = 'bandpass';
    filtro.frequency.value = freq;
    filtro.Q.value = 0.7;
    g.gain.value = vol;
    fonte.connect(filtro).connect(g).connect(audio.destination);
    fonte.start();
  }

  function som(tipo) {
    if (!somLigado) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (tipo === 'carta') { papel(0.13, 2600, 0.7); nota(520, 0.02, 0.07, 'triangle', 0.06); }
      if (tipo === 'rasgar') papel(0.5, 1500, 0.9);
      if (tipo === 'revelar') {
        nota(140, 0, 0.3, 'sine', 0.45, 50);
        [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => nota(f, 0.12 + k * 0.08, 0.45, 'triangle', 0.1));
      }
    } catch (e) { /* navegador sem Web Audio: joga sem som */ }
  }

  function marcarSom() {
    const b = $('#btn-som');
    b.setAttribute('aria-pressed', String(somLigado));
    b.classList.toggle('mudo', !somLigado);
  }

  // ---------- eventos ----------
  $('#btn-comecar').addEventListener('click', () => {
    reanimar($('#nome'));
    mostrar('nome');
    $('#campo-nome').focus({ preventScroll: true });
  });
  $('#campo-nome').addEventListener('input', e => {
    $('.previa-nome').textContent = e.target.value.trim() || T.previa_vazio;
  });
  $('#form-nome').addEventListener('submit', e => {
    e.preventDefault();
    nome = $('#campo-nome').value.trim().replace(/\s+/g, ' ').slice(0, 20);
    comecar();
  });
  $('#intro .intro-seguir').addEventListener('click', proximo);
  $('#btn-voltar').addEventListener('click', voltar);
  $('#btn-som').addEventListener('click', () => {
    somLigado = !somLigado;
    try { localStorage.setItem('adm-som', somLigado ? 'on' : 'off'); } catch (e) { /* ok */ }
    marcarSom();
  });
  $('#btn-imprimir').addEventListener('click', () => window.print());
  $('#btn-reiniciar').addEventListener('click', reiniciar);
  marcarSom();

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const tela = document.body.dataset.tela;
    const k = e.key.toLowerCase();
    if (tela === 'pergunta' || tela === 'vs') {
      const mapa = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3, arrowleft: 0, arrowright: 1 };
      if (k in mapa && !travado) {
        const carta = $$(`#${tela} .opcao`)[mapa[k]];
        if (carta) { e.preventDefault(); carta.click(); }
      } else if (k === 'escape' || k === 'backspace') {
        e.preventDefault();
        voltar();
      }
    }
  });

  mostrar('inicio');
})();
