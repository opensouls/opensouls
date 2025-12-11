
export const organizationBucketName = (bucketName: string) => {
  const prefix = "__organization-store-"
  return `${prefix}${bucketName}`
}

export const blueprintBucketName = (bluprintName: string, bucketName: string) => {
  const prefix = `__blueprint-store-${bluprintName}-`
  return `${prefix}${bucketName}`
}
