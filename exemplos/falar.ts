/**
 * Voz Artur em TypeScript (Node 18+, Next.js, Vercel). Rode SEMPRE no servidor:
 * a chave do Google nunca pode ir para o navegador.
 *
 * Custo zero: passe em `reservar` uma função que soma os caracteres no contador
 * do mês e devolve false quando não cabem (veja contador/voz_uso.sql — no
 * Supabase: `supabase.rpc("fn_voz_reservar", { p_mes, p_voz, p_caracteres, p_limite })`).
 * Sem contador, nada impede passar da cota grátis.
 */
export const VOZ_ARTUR = {
  endpoint: "https://texttospeech.googleapis.com/v1/text:synthesize",
  voz: "pt-BR-Chirp3-HD-Algenib",
  reserva: "pt-BR-Wavenet-B",
  velocidade: 1.25,
  // 95% da cota grátis mensal de cada voz (caracteres)
  limite: { "pt-BR-Chirp3-HD-Algenib": 950_000, "pt-BR-Wavenet-B": 3_800_000 } as Record<string, number>,
} as const;

/** Mês de cobrança do Google (a fatura fecha no horário do Pacífico). */
export function mesDoGoogle(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" })
    .format(agora)
    .slice(0, 7);
}

type Reservar = (mes: string, voz: string, caracteres: number, limite: number) => Promise<boolean>;

async function sintetizar(texto: string, voz: string, velocidade: number): Promise<Buffer> {
  const res = await fetch(process.env.GOOGLE_TTS_ENDPOINT || VOZ_ARTUR.endpoint, {
    method: "POST",
    // chave no cabeçalho, nunca na URL
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_TTS_API_KEY ?? "" },
    body: JSON.stringify({
      input: { text: texto },
      voice: { languageCode: "pt-BR", name: voz },
      audioConfig: { audioEncoding: "MP3", speakingRate: velocidade },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const j = (await res.json()) as { audioContent?: string };
  if (!j.audioContent) throw new Error("Google TTS sem áudio");
  return Buffer.from(j.audioContent, "base64");
}

/** MP3 na voz Artur; `null` = cota grátis do mês esgotada (nada foi enviado). */
export async function falarArtur(
  texto: string,
  reservar: Reservar,
  velocidade: number = VOZ_ARTUR.velocidade,
): Promise<{ audio: Buffer; voz: string } | null> {
  const mes = mesDoGoogle();
  for (const voz of [VOZ_ARTUR.voz, VOZ_ARTUR.reserva]) {
    // limite próprio deste sistema quando a cota é dividida com outro (ex.: dois sistemas usando a mesma chave)
    const proprio = Number(voz === VOZ_ARTUR.voz ? process.env.ARTUR_LIMITE_PRINCIPAL : process.env.ARTUR_LIMITE_RESERVA);
    const limite = proprio > 0 ? proprio : VOZ_ARTUR.limite[voz];
    if (!(await reservar(mes, voz, texto.length, limite))) continue;
    try {
      return { audio: await sintetizar(texto, voz, velocidade), voz };
    } catch (e) {
      console.error("[voz Artur]", e);
    }
  }
  return null;
}

// uso direto (teste): npx tsx exemplos/falar.ts "Texto" saida.mp3 — contador em memória, só para teste
if (process.argv[1]?.endsWith("falar.ts") && process.argv[2]) {
  void (async () => {
    const { writeFile } = await import("node:fs/promises");
    const uso = new Map<string, number>();
    const emMemoria: Reservar = async (mes, voz, n, limite) => {
      const k = `${mes}|${voz}`;
      if ((uso.get(k) ?? 0) + n > limite) return false;
      uso.set(k, (uso.get(k) ?? 0) + n);
      return true;
    };
    const r = await falarArtur(process.argv[2], emMemoria);
    if (!r) throw new Error("cota esgotada");
    const destino = process.argv[3] ?? "artur.mp3";
    await writeFile(destino, r.audio);
    console.log(`${destino} (${r.voz})`);
  })();
}
