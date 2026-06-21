const generateInviteToken = () => crypto.randomUUID().replace(/-/g, "");

export { generateInviteToken };
