const generateInviteToken = () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let token = "";

  for (let index = 0; index < 32; index += 1) {
    token += alphabet[bytes[index] % alphabet.length];
  }

  return token;
};

export { generateInviteToken };
