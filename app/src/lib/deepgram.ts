export async function transcribe(audio: Buffer, mimeType: string): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY not set");

  const url =
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(audio),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Deepgram ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return transcript;
}
