import { auth } from "@/lib/auth";
import { getRequestHeaders } from "@/lib/request-headers";

const getServerSession = async () => {
  return auth.api.getSession({
    headers: await getRequestHeaders(),
  });
};

const requireApiUserSession = async () => {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  });
  if (!session?.user) {
    return { response: new Response(null, { status: 401 }) };
  }

  return { user: session.user };
};

export { getServerSession, requireApiUserSession };
