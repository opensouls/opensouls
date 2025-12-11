
export const documentNameToAttributes = (documentName: string) => {
  const [docType, organizationSlug, subroutineSlug, sessionId, userSpecifiedVersion] = documentName.split(".")
  return {
    docType,
    organizationSlug,
    subroutineSlug,
    sessionId,
    userSpecifiedVersion
  }
}
