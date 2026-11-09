# Artur-Voz

**Tutorial: como dar uma voz natural, em português do Brasil, ao seu sistema, de graça**, usando a cota grátis mensal do Google Cloud Text-to-Speech e um contador que garante que você nunca passe dela.

🔊 Ouça: [`amostras/artur-1,25x-demonstracao.mp3`](amostras/artur-1,25x-demonstracao.mp3)

"Artur" é só um apelido fácil de lembrar para a voz `pt-BR-Chirp3-HD-Algenib` do Google: masculina, clara, a 1,25× para ficar objetiva.

## Por que esta voz

| | |
|---|---|
| **Custo** | Zero dentro da cota grátis do Google: 1 milhão de caracteres por mês nas vozes Chirp 3 HD e 4 milhões nas WaveNet. Para comparar, 100 respostas por dia, com 200 a 400 caracteres cada, dão de 0,6 a 1,2 milhão por mês. |
| **Qualidade** | Chirp 3 HD é a família de vozes mais natural do Google. |
| **Velocidade** | Cerca de 1 a 2 segundos por frase. |
| **Privacidade** | A documentação do Google diz que *"Google does not log any customer Cloud TTS text or audio data"*, ou seja, não registra o texto nem o áudio. |
| **Manutenção** | Não há servidor seu. É só uma chamada de API. |

## Passo a passo no Google Cloud (uma vez)

1. Entre em [console.cloud.google.com](https://console.cloud.google.com) e **crie um projeto** só para este sistema.
2. **Ative o faturamento** do projeto (Faturamento → vincular conta). O Google exige cartão mesmo para a cota grátis, mas só cobra o que passar dela.
3. Ative a **Cloud Text-to-Speech API** (APIs e serviços → Biblioteca).
4. Crie uma **chave de API** em APIs e serviços → Credenciais → Criar credenciais → Chave de API:
   - **Restrições da API:** marque só a **Cloud Text-to-Speech API**. Assim, se a chave vazar, ela só serve para gerar voz.
   - **Restrições do aplicativo:** se o seu servidor tem IP fixo, restrinja por IP. Em servidores sem IP fixo (Vercel, Netlify), deixe "Nenhum" e guarde a chave só no servidor.
5. Crie um **alerta de orçamento** em Faturamento → Orçamentos e alertas, com valor baixo (por exemplo, R$ 5) e e-mail em 50%, 90% e 100%. O alerta não bloqueia nada, mas avisa se algo escapar do contador.

## Como usar

```bash
cp .env.example .env        # cole a chave em GOOGLE_TTS_API_KEY
python3 exemplos/falar.py "Feito. Cadastrei o prazo para sexta-feira." saida.mp3
npx tsx exemplos/falar.ts "Feito. Cadastrei o prazo para sexta-feira." saida.mp3
```

Num sistema web (Next.js, Vercel), copie a função `falarArtur` de [`exemplos/falar.ts`](exemplos/falar.ts) para uma rota **do servidor**. A chave nunca pode ir para o navegador.

## A regra de ouro: sempre use o contador

O Google cobra o que passar da cota, e não existe um botão de "parar quando acabar o grátis". Quem garante o custo zero é o **seu** contador:

- Antes de cada chamada, o contador soma os caracteres do mês e só libera o texto se ele couber em **95% da cota**.
- Esgotou a voz principal, ele passa para a reserva, `pt-BR-Wavenet-B`, que tem cota maior. Esgotou a reserva também, use a voz do próprio sistema operacional ou do navegador (`speechSynthesis`). **Nunca** passe para uma voz paga.
- O mês é o de cobrança do Google, no **horário do Pacífico**.
- **Tem um único servidor?** O contador em arquivo de [`exemplos/falar.py`](exemplos/falar.py) serve.
- **Tem vários servidores ou serverless?** Use o banco: [`contador/voz_uso.sql`](contador/voz_uso.sql) traz uma tabela e uma função de reserva atômica para Postgres ou Supabase.
- **Dois sistemas usam a mesma chave ou conta?** Eles dividem a mesma cota. Dê a cada um o seu limite (`ARTUR_LIMITE_PRINCIPAL` e `ARTUR_LIMITE_RESERVA`), de forma que a soma não passe de 95% da cota.

## Escolher outra voz

O Google publica amostras de todas as vozes em português em [docs.cloud.google.com/text-to-speech/docs/list-voices-and-types](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types). Para usar outra, troque o nome em [`voz.json`](voz.json) e nos exemplos. As masculinas Chirp 3 HD em pt-BR são: Achird, Algenib, Algieba, Alnilam, Charon, Enceladus, Fenrir, Iapetus, Orus, Puck, Rasalgethi, Sadachbia, Sadaltager, Schedar, Umbriel e Zubenelgenubi.

## Dicas

- **Frases curtas primeiro:** divida respostas longas em frases e peça a primeira antes. A fala começa enquanto as outras chegam.
- **Limpe o texto antes:** tire links, markdown e emojis, e troque abreviações ("Dr." por "Doutor", "art." por "artigo"). Cada caractere conta na cota.
- **Confira o preço:** os preços e cotas citados aqui foram conferidos em novembro de 2026, em https://cloud.google.com/text-to-speech/pricing. Confira de novo antes de usar.
