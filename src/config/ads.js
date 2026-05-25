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

Você sabia que dá pra ganhar R$547 por dia lavorando em casa?
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

A resposta tá num click! Método testado e aprovado
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
  {
    text: `📱 <b>App que PAGA de verdade!</b>

Ganhe dinheiro usando o celular! 
Já são +50 mil pessoas lucrando todo dia.

👉 <a href="https://t.me/adsblackbrbot">Testar Grátis</a>`,
    buttonText: "📲 BAIXAR AGORA!",
  },
  {
    text: `💡 <b>Ninguém te contou isso...</b>

Tem um jeito simples de fazer renda extra
que a galera tá escondendo. Vem ver! 👇

👉 <a href="https://t.me/lbrabo">Canal</a>`,
    buttonText: "👀 QUERO SABER!",
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
Clica abaixo e descubre como!

📚 <a href="https://t.me/cursobroff">Cursos</a> | 📣 <a href="https://t.me/lbrabo">Canal</a>`,
    buttonText: "🚀 VER COMO É!",
  },
  {
    text: `💡 <b>Povo! Deixa eu te contar...</b>

Tá tendo uma chance de mudar!
Ninguém mais precisa trabalhar 8h por dia!

Clica! 👇`,
    buttonText: "💵 QUERO SABER MAIS!",
  },
  {
    text: `🎯 <b>E aí, bora ganhar?</b>

Milhares de mano já tão na disputa!
Bora com nóis? Clica abaixo!

📣 <a href="https://t.me/lbrabo">@lbrabo</a>`,
    buttonText: "🤑 VEM COM A GENTE!",
  },
  {
    text: `🔥 <b>Alerta de oportunidade!</b>

O Toguro indica! Método show de bola!
Clique abaixo e aproveite!

📚 <a href="https://t.me/cursobroff">@cursobroff</a>`,
    buttonText: "⚡ APROVEITAR JÁ!",
  },
  {
    text: `💡 <b>Dica do Helana pra vocês!</b>\n\nDescobre como tantos estão ganhando dinheiro online com poucos cliques. Do interesse ao pagamento em segundos!\n\n📚 Cursos novos: <a href="https://t.me/cursobroff">@cursobroff</a>`,
    buttonText: "💡 Quero Descobrir!",
  },
  {
    text: `⚡ <b>GANHE ATÉ R$200/DIA EM CASA!</b>

Método simples: só assistir anúncios e ganhar!
Muitos já tão lucrando! 👇

👉 <a href="https://t.me/adsblackbrbot">Começar Agora</a>`,
    buttonText: "🚀 VEM GANHAR COMIGO!",
  },
  {
    text: `⚡ <b>Helana indica!</b>\n\nEssa é a melhor forma de monetizar seu tempo online que eu já vi. Direto ao ponto: link, pagamento, feito!\n\n📚 <a href="https://t.me/cursobroff">@cursobroff</a>`,
    buttonText: "⚡ Acessar!",
  },
  {
    text: `📱 <b>Galera, olha só!</b>

App que paga de verdade pra usar no celular!
Simples assim, sem mistério. 👇

👉 <a href="https://t.me/adsblackbrbot">Testar Grátis</a>`,
    buttonText: "📲 BAIXAR APP!",
  },
  {
    text: `💰 <b>Render extra sem sair de casa!</b>

A galera já tá lucrando com isso.
É só clicar e começar! 👇

📣 <a href="https://t.me/lbrabo">@lbrabo</a>`,
    buttonText: "🔥 COMEÇAR AGORA!",
  },
];

module.exports = { adsterra: { links, userTemplates, groupTemplates } };