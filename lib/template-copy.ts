import { createOctokitInstance } from "@/lib/utils/octokit";
import { getInstallations } from "@/lib/github-app";
import { requireGithubUserToken } from "@/lib/authz-server";
import templates from "@/lib/templates";
import type { User } from "@/types/user";

const copyTemplate = async (
  user: User,
  {
    template,
    owner,
    name,
  }: {
    template: string;
    owner: string;
    name: string;
  },
) => {
  const token = await requireGithubUserToken(
    user,
    "You must be signed in with GitHub to copy a template.",
  );

  const templateRepos = templates.map((entry) => entry.repository);
  if (!templateRepos.includes(template)) {
    throw new Error("Invalid template repository");
  }

  const installations = await getInstallations(token, [owner]);
  if (installations.length !== 1) {
    throw new Error(`"${owner}" is not part of your GitHub App installations`);
  }

  const [templateOwner, templateRepo] = template.split("/");
  const octokit = createOctokitInstance(token);
  const response = await octokit.rest.repos.createUsingTemplate({
    template_owner: templateOwner,
    template_repo: templateRepo,
    owner,
    name,
  });

  return {
    message: `"${template}" successfully copied as "${response.data.full_name}".`,
    data: {
      template,
      owner,
      repo: name,
      branch: response.data.default_branch,
    },
  };
};

export { copyTemplate };
