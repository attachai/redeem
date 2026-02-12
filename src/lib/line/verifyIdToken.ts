export interface LineProfile {
  sub: string; // LINE userId
  name: string;
  picture?: string;
  email?: string;
}

export async function verifyLineIdToken(idToken: string): Promise<LineProfile> {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) throw new Error("LINE_CHANNEL_ID not set");

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LINE verify failed: ${err}`);
  }

  const data = await res.json();
  return {
    sub: data.sub,
    name: data.name,
    picture: data.picture,
    email: data.email,
  };
}
