import { Context } from "koa";

// Configuración para controlar las peticiones
const CONCURRENT_REQUESTS = 3; // Máximo 3 peticiones simultáneas
const REQUEST_TIMEOUT = 8000; // 8 segundos timeout
const RETRY_ATTEMPTS = 2; // 2 reintentos
const DELAY_BETWEEN_BATCHES = 500; // 500ms entre batches

// Cache para evitar peticiones duplicadas
const imageCache = new Map<string, { valid: boolean; message: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Función para crear timeout con AbortController
const createTimeoutFetch = (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return fetch(url, { 
    signal: controller.signal,
    headers: {
      'User-Agent': 'VTEX-ImageChecker/1.0',
      'Accept': 'image/*,*/*;q=0.8'
    }
  }).finally(() => {
    clearTimeout(timeoutId);
  });
};

// Función para validar una imagen con reintentos
const validateSingleImage = async (imageUrl: string, attempt: number = 1): Promise<{
  message: string;
  valid: boolean;
  imageUrl: string;
}> => {
  // Verificar cache primero
  const cached = imageCache.get(imageUrl);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return {
      message: `${cached.message} (cached)`,
      valid: cached.valid,
      imageUrl
    };
  }

  try {
    console.log(`Validating image (attempt ${attempt}): ${imageUrl}`);
    
    const response = await createTimeoutFetch(imageUrl, REQUEST_TIMEOUT);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Verificar que sea realmente una imagen
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType || 'unknown'}`);
    }

    // Verificar tamaño razonable (máximo 10MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      throw new Error('Image too large (>10MB)');
    }

    const result = {
      message: "Image fetched successfully",
      valid: true,
      imageUrl
    };

    // Guardar en cache
    imageCache.set(imageUrl, {
      valid: true,
      message: result.message,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Si es timeout o error de red y tenemos reintentos disponibles
    if (attempt < RETRY_ATTEMPTS && (
      errorMessage.includes('timeout') || 
      errorMessage.includes('network') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      (typeof error === 'object' && error !== null && 'name' in error && (error as { name: string }).name === 'AbortError')
    )) {
      console.log(`Retrying image validation (${attempt + 1}/${RETRY_ATTEMPTS}): ${imageUrl}`);
      
      // Esperar antes del reintento (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
      return validateSingleImage(imageUrl, attempt + 1);
    }

    const result = {
      message: `Error fetching image: ${errorMessage}`,
      valid: false,
      imageUrl
    };

    // Guardar error en cache (TTL más corto para errores)
    imageCache.set(imageUrl, {
      valid: false,
      message: result.message,
      timestamp: Date.now()
    });

    return result;
  }
};

// Función para procesar imágenes en lotes con control de concurrencia
const processImageBatch = async (images: Array<{ imageUrl: string }>, batchSize: number): Promise<Array<{
  message: string;
  valid: boolean;
  imageUrl: string;
}>> => {
  const results: Array<{
    message: string;
    valid: boolean;
    imageUrl: string;
  }> = [];

  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(images.length / batchSize)} (${batch.length} images)`);

    // Procesar el batch en paralelo con Promise.allSettled para no fallar todo si una imagen falla
    const batchPromises = batch.map(image => validateSingleImage(image.imageUrl));
    const batchResults = await Promise.allSettled(batchPromises);

    // Procesar resultados del batch
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Si Promise.allSettled falla (muy raro), crear resultado de error
        results.push({
          message: `Batch processing failed: ${result.reason}`,
          valid: false,
          imageUrl: batch[index].imageUrl
        });
      }
    });

    // Pausa entre batches para no sobrecargar el servidor
    if (i + batchSize < images.length) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  return results;
};

// Función para limpiar cache antigua
const cleanupCache = () => {
  const now = Date.now();
  for (const [url, data] of imageCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      imageCache.delete(url);
    }
  }
};

export async function checkImages(ctx: Context) {
  const { request } = ctx;
  
  // Limpiar cache antigua
  cleanupCache();

  const images = request.body || ([] as Array<{ imageUrl: string }>);

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

  // Validar URLs antes de procesarlas
  const validImages = images.filter(image => {
    if (!image.imageUrl || typeof image.imageUrl !== 'string') {
      return false;
    }
    try {
      new URL(image.imageUrl);
      return true;
    } catch {
      return false;
    }
  });

  if (validImages.length === 0) {
    ctx.status = 400;
    ctx.body = { message: "No valid image URLs provided." };
    return;
  }

  // Remover duplicados
  const uniqueImages = validImages.filter((image, index, self) => 
    index === self.findIndex(i => i.imageUrl === image.imageUrl)
  );

  console.log(`Processing ${uniqueImages.length} unique images (${images.length - uniqueImages.length} duplicates removed)`);
  console.log(`Current cache size: ${imageCache.size}`);

  try {
    const results = await processImageBatch(uniqueImages, CONCURRENT_REQUESTS);
    
    // Estadísticas para logging
    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.length - validCount;
    const cacheHits = results.filter(r => r.message.includes('cached')).length;
    
    console.log(`Image validation completed: ${validCount} valid, ${invalidCount} invalid, ${cacheHits} cache hits`);

    ctx.status = 200;
    ctx.body = results;

  } catch (error) {
    console.error('Error in checkImages:', error);
    ctx.status = 500;
    ctx.body = { 
      message: "Internal server error during image validation",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Exportar función para limpiar cache manualmente si es necesario
export const clearImageCache = () => {
  imageCache.clear();
  console.log('Image cache cleared');
};

// Función para obtener estadísticas del cache
export const getCacheStats = () => {
  const now = Date.now();
  const entries = Array.from(imageCache.entries());
  const validEntries = entries.filter(([_, data]) => now - data.timestamp < CACHE_TTL);
  
  return {
    totalEntries: imageCache.size,
    validEntries: validEntries.length,
    expiredEntries: entries.length - validEntries.length,
    cacheHitRatio: validEntries.filter(([_, data]) => data.valid).length / validEntries.length || 0
  };
};