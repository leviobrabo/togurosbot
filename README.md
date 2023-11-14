# ToguroBot

## Chat Bot for Telegram

[![](https://img.shields.io/badge/Telegram-@togurosbot-blue)](https://t.me/TogurosBot)
[![](https://img.shields.io/badge/Suporte-@kylorensbot-1b2069)](https://t.me/kylorensbot)
[![](https://img.shields.io/badge/Telegram-Update_Toguro-blue)](https://t.me/togurovisao)

Toguro envia mensagem, que são aprendidas a partir das mensagem envidas no chat... envia áudios, fotos e stickers...

Demostração:

[![](https://i.imgur.com/qc6PrG8.png)](#)

### Pré-requisitos

Você vai precisar ter instalado em sua máquina as seguintes ferramentas:

-   [Git](https://git-scm.com)
-   [Node.js](https://nodejs.org/en/)
-   [MongoDB](https://cloud.mongodb.com/)

### 🤖 Deploy no Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### 🤖 Rodando o bot localmente

```bash
# Clone este repositório
$ git clone https://github.com/leviobrabo/togurosbot.git

# Acesse a pasta do projeto no terminal/cmd
$ cd togurosbot

# Instale as dependências

# Usando o NPM:
$ npm i

# Variáveis ambientes

# Crie um arquivo com .env com qualquer editor de texto e coloque:
DB_STRING=#URL de conexão com o MongoDB
TELEGRAM_API=#Token do seu bot gerado no @BotFather
groupId=#ID DO GRUPO TELEGRAM (-1001932261893)
DEV_USERS=#ID_DEV // userId1,userId2,userId3


# Execute a aplicação
$ npm start

```

### Baseado no Chester bot

-   [Chesterbot](https://github.com/Rev3rs1d/chesterbot)

## Pronto, o bot já estará rodando
