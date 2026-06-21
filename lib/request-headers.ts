import { headers } from "next/headers";

const getRequestHeaders = async () => headers();

export { getRequestHeaders };
