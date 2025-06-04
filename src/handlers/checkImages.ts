import { Context } from "koa";

export async function checkImages(ctx: Context) {
  const { request } = ctx;
  
  const ctxBody: Array<{
    message: string;
    valid: boolean;
    imageUrl: string;
  }> = [];

  const images = request.body || ([] as Array<{ ImageUrl: string }>);

  if (!Array.isArray(images)) {
    ctx.status = 400;
    ctx.body = { message: "Invalid input, expected an array of images." };
    return;
  }

  if (!images || images.length === 0) {
    ctx.status = 400;
    ctx.body = { message: "No images provided." };
    return;
  }

  for (const image of images) {
    try {
      const response = await fetch(image.ImageUrl);
      if (!response.ok) {
        throw new Error(`${response.statusText}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      ctxBody.push({
        message: "Image fetched successfully",
        valid: true,
        imageUrl: image.ImageUrl,
      });
    } catch (error) {
      ctxBody.push({
        message: `Error fetching image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        valid: false,
        imageUrl: image.ImageUrl,
      });
    }
  }
  ctx.status = 200;
  ctx.body = ctxBody;
}
