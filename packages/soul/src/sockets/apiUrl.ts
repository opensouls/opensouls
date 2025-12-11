export const apiUrl = (organizationSlug: string, local: boolean) => {
  return local ?
    `http://localhost:4000/api/${organizationSlug}` :
    `https://servers.souls.chat/api/${organizationSlug}`
}
