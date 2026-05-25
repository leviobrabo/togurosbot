const links = [
  "https://omg10.com/4/10930545",
  "https://omg10.com/4/10930547",
  "https://omg10.com/4/10930546",
  "https://omg10.com/4/10930523",
  "https://omg10.com/4/10963924",
  "https://omg10.com/4/10963927",
  "https://omg10.com/4/10963930",
  "https://omg10.com/4/10963933",
  "https://www.profitablecpmratenetwork.com/djt7wpcj5z?key=3baa748bc0990b4b5c6727d07024a044",
  "https://www.profitablecpmratenetwork.com/ge7mn5gp?key=bebb7238590df1a541984429b5f12a77",
  "https://www.profitablecpmratenetwork.com/sjnxjg5x?key=512d296dd7bce4c432e80e070ba62fb9",
  "https://www.profitablecpmratenetwork.com/tdzhuvh1?key=e3443f5ad0657b7ca27193f9b13aa87e",
  "https://www.profitablecpmratenetwork.com/cq3hxfki?key=62cf0735cf731bb51245a4898086a824",
  "https://www.profitablecpmratenetwork.com/sjnxjg5x?key=512d296dd7bce4c432e80e070ba62fb9",
  "https://t.me/adsblackbrbot",
];

const userTemplates = [
  {
    text: `🔥 <b>ATENÇÃO: R$547 por dia — vem ver!</b>

Você sabia que dá pra ganhar R$547 por dia trabalhando em casa?
Milhares de brasileiros já estão fazendo isso HOJE.

👉 <a href="https://t.me/lbrabo">Canal de Novidades</a> | <a href="https://t.me/cursobroff">Cursos</a>`,
    buttonText: "💵 QUERO GANHAR R$547!",
  },
  {
    text: `⚡ <b>Oferta IMPERDÍVEL — só hoje!</b>

Não perca a chance de mudar sua vida!
Método simples que já ajudou +10.000 pessoas.

Não fica pensando — clica logo abaixo! 🚀`,
    buttonText: "🚀 GARANTIR MINHA VAGA!",
  },
  {
    text: `💰 <b>Como ganhar R$547 POR DIA?</b>

A resposta tá num clique! Método testado e aprovado
por milhares de brasileiros comuns como você.

👉 <a href="https://t.me/lbrabo">Segue o canal</a> | <a href="https://t.me/cursobroff">Cursos</a>`,
    buttonText: "💰 VER COMO FAZER",
  },
  {
    text: `🎯 <b>Você tá perdendo dinheiro!</b>

Enquanto você lê isso, outros tão ganhando R$547...
O que você tá esperando? Clica agora!

📣 <a href="https://t.me/lbrabo">@lbrabo</a> | 📚 <a href="https://t.me/cursobroff">@cursobroff</a>`,
    buttonText: "🤑 QUERO GANHAR HOJE!",
  },
  {
    text: `🔥 <b>SÓ HOJE: Oportunidade ÚNICA!</b>

Não vai ter outra chance dessas!
Clique no botão abaixo e descubra como!

⏰ Não pensa — clica agora!`,
    buttonText: "🎁 ACESSAR OFERTA!",
  },
  {
    text: `💵 <b>R$547 por dia — REAL!</b>

Pare de perder tempo com coisa que não funciona.
Método comprovado que TÁ FUNCIONANDO!

👉 <a href="https://t.me/lbrabo">Canal</a> | <a href="https://t.me/cursobroff">Cursos</a>`,
    buttonText: "⚡ QUERO COMEÇAR AGORA!",
  },
  {
    text: `💰 <b>GANHE DINHEIRO EXTRA EM CASA!</b>

Você sabia que dá pra ganhar R$200 por dia só assistindo anúncios?
Simples e sem complicação! 👇

👉 <a href="https://t.me/adsblackbrbot">Bot de Ganhar</a>`,
    buttonText: "💵 QUERO COMEÇAR!",
  },
  {
    text: `⚡ <b>GANHE ATÉ R$200/DIA EM CASA!</b>

Método simples: só assistir anúncios e ganhar!
Muitos já tão lucrando! 👇

👉 <a href="https://t.me/adsblackbrbot">Começar Agora</a>`,
    buttonText: "🚀 VEM GANHAR COMIGO!",
  },
  {
    text: `🎯 <b>Oportunidade de Ouro!</b>

Ganha dinheiro extra sem sair de casa!
Só assistindo anúncios você já pode lucrar! 👇

👉 <a href="https://t.me/adsblackbrbot">Começar</a> | <a href="https://t.me/lbrabo">Novidades</a>`,
    buttonText: "🤑 QUERO PARTICIPAR!",
  },
];

const groupTemplates = [
  {
    text: `🔥 <b>Galera! R$547 por dia? SIM!</b>

Muitos já estão fazendo isso!
Bora entrar nessa too?

📣 <a href="https://t.me/lbrabo">Novidades</a> | <a href="https://t.me/cursobroff">Cursos</a>`,
    buttonText: "💰 ENTRAR NESSE LINK!",
  },
  {
    text: `⚡ <b>Fica ligado, galera!</b>

Oportunidade boa na área!
Clica abaixo e descubra como!

📚 <a href="https://t.me/cursobroff">Cursos</a> | 📣 <a href="https://t.me/lbrabo">Canal</a>`,
    buttonText: "🚀 VER COMO É!",
  },
  {
    text: `💡 <b>Povo! Deixa eu te contar...</b>

Tá tendo uma chance de mudar!
Ninguém mais precisa trabalhar 8h por dia!

Cliqueeee! 👇`,
    buttonText: "💵 QUERO SABER MAIS!",
  },
  {
    text: `🎯 <b>E aí, bora ganhar?</b>

Milhares de tano já tão na disputa!
Bora com nóis? Clica abaixo!

📣 <a href="https://t.me/lbrabo">@lbrabo</a>`,
    buttonText: "🤑 VEM COM A GENTE!",
  },
  {
    text: `🔥 <b>Alerta de oportunidade!</b>

O Toguro indica! Método show de bola!
Clica abaixo e aproveita!

📚 <a href="https://t.me/cursobroff">@cursobroff</a>`,
    buttonText: "⚡ APROVEITAR JÁ!",
  },
  {
    text: `💰 <b>GANHE DINHEIRO EXTRA EM CASA!</b>

Você sabia que dá pra ganhar R$200 por dia só assistindo anúncios?
Simples e sem complicação! 👇

👉 <a href="https://t.me/adsblackbrbot">Bot de Ganhar</a>`,
    buttonText: "💵 QUERO COMEÇAR!",
  },
  {
    text: `⚡ <b>GANHE ATÉ R$200/DIA EM CASA!</b>

Método simples: só assistir anúncios e ganhar!
Muitos já tão lucrando! 👇

👉 <a href="https://t.me/adsblackbrbot">Começar Agora</a>`,
    buttonText: "🚀 VEM GANHAR COMIGO!",
  },
  {
    text: `🎯 <b>Oportunidade de Ouro!</b>

Ganha dinheiro extra sem sair de casa!
Só assistindo anúncios você já pode lucrar! 👇

👉 <a href="https://t.me/adsblackbrbot">Começar</a> | <a href="https://t.me/lbrabo">Novidades</a>`,
    buttonText: "🤑 QUERO PARTICIPAR!",
  },
];

module.exports = { adsterra: { links, userTemplates, groupTemplates } };
