/**
 * S3 image orchestration for product and profile uploads, including presigned
 * upload URLs, private read URLs, and managed-object validation helpers.
 */
import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  CreateProductImagePresignDto,
  CreateProfileImagePresignDto,
} from "../dto/uploads.dto.js";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const PRESIGN_EXPIRY_SECONDS = 900;
const READ_URL_EXPIRY_SECONDS = 3600;

let s3Client: S3Client | null = null;

/**
 * Reads the AWS region used by the uploads subsystem.
 */
export function getAwsRegion(): string {
  const region = process.env.AWS_REGION?.trim();

  if (!region) {
    throw new Error("AWS_REGION is required for product image uploads");
  }

  return region;
}

/**
 * Resolves the bucket used for all managed application images.
 */
export function getProductImageBucket(): string {
  const bucket = process.env.S3_PRODUCT_IMAGE_BUCKET?.trim();

  if (!bucket) {
    throw new Error("S3_PRODUCT_IMAGE_BUCKET is required for product image uploads");
  }

  return bucket;
}

/**
 * Returns the public base URL used to compose legacy file URLs or CDN-backed
 * URLs when configured.
 */
export function getProductImagePublicBaseUrl(bucket: string, region: string): string {
  const configuredBaseUrl = process.env.S3_PRODUCT_IMAGE_PUBLIC_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getAwsRegion(),
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return s3Client;
}

function sanitizeFilename(filename: string): string {
  const normalized = filename
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "image";
}

/**
 * Builds a URL from a managed object key using the configured public base URL.
 */
export function buildProductImageUrlFromObjectKey(objectKey: string): string {
  const region = getAwsRegion();
  const bucket = getProductImageBucket();
  return `${getProductImagePublicBaseUrl(bucket, region)}/${objectKey}`;
}

/**
 * Creates a short-lived signed GET URL for a private image object.
 */
export async function createSignedImageReadUrl(
  objectKey: string,
): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: getProductImageBucket(),
      Key: objectKey,
    }),
    { expiresIn: READ_URL_EXPIRY_SECONDS },
  );
}

/**
 * Resolves the image URL returned to clients, preferring a signed private URL
 * when an object key is available.
 */
export async function resolveStoredImageUrl(
  objectKey: string | null | undefined,
  fallbackUrl: string | null | undefined,
): Promise<string | null> {
  if (objectKey) {
    return createSignedImageReadUrl(objectKey);
  }

  return fallbackUrl ?? null;
}

/**
 * Restricts automatic cleanup to image keys generated and owned by the app.
 */
export function isManagedImageObjectKey(objectKey: string | null | undefined): boolean {
  const normalizedKey = objectKey?.trim();

  return Boolean(
    normalizedKey &&
      normalizedKey.length > 0 &&
      normalizedKey.startsWith("images/") &&
      !normalizedKey.includes("..") &&
      !normalizedKey.startsWith("/"),
  );
}

/**
 * Removes a managed image object from S3 after successful replacement/removal.
 */
export async function deleteImageObject(
  objectKey: string,
): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getProductImageBucket(),
      Key: objectKey,
    }),
  );
}

/**
 * Validates that a product image object key stays inside the current
 * organization's managed prefix.
 */
export function isValidProductImageObjectKeyForOrganization(
  orgId: string,
  objectKey: string,
): boolean {
  const normalizedKey = objectKey.trim();

  return (
    normalizedKey.length > 0 &&
    normalizedKey.startsWith(`images/products/${orgId}/`) &&
    !normalizedKey.includes("..") &&
    !normalizedKey.startsWith("/")
  );
}

/**
 * Validates that a profile image object key stays inside the current account's
 * managed prefix.
 */
export function isValidProfileImageObjectKeyForAccount(
  accountId: string,
  objectKey: string,
): boolean {
  const normalizedKey = objectKey.trim();

  return (
    normalizedKey.length > 0 &&
    normalizedKey.startsWith(`images/profiles/${accountId}/`) &&
    !normalizedKey.includes("..") &&
    !normalizedKey.startsWith("/")
  );
}

/**
 * Generates a presigned PUT URL and managed object key for product image
 * uploads.
 */
export async function createProductImageUploadPresign(
  orgId: string,
  input: CreateProductImagePresignDto,
): Promise<{
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresIn: number;
}> {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(input.contentType)) {
    throw new Error("Unsupported image content type");
  }

  const region = getAwsRegion();
  const bucket = getProductImageBucket();
  const safeFilename = sanitizeFilename(input.filename);
  const objectKey = `images/products/${orgId}/${Date.now()}-${randomUUID()}-${safeFilename}`;
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
    }),
    { expiresIn: PRESIGN_EXPIRY_SECONDS },
  );

  return {
    uploadUrl,
    fileUrl: `${getProductImagePublicBaseUrl(bucket, region)}/${objectKey}`,
    objectKey,
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  };
}

/**
 * Generates a presigned PUT URL and managed object key for profile image
 * uploads.
 */
export async function createProfileImageUploadPresign(
  accountId: string,
  input: CreateProfileImagePresignDto,
): Promise<{
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresIn: number;
}> {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(input.contentType)) {
    throw new Error("Unsupported image content type");
  }

  const region = getAwsRegion();
  const bucket = getProductImageBucket();
  const safeFilename = sanitizeFilename(input.filename);
  const objectKey = `images/profiles/${accountId}/${Date.now()}-${randomUUID()}-${safeFilename}`;
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
    }),
    { expiresIn: PRESIGN_EXPIRY_SECONDS },
  );

  return {
    uploadUrl,
    fileUrl: `${getProductImagePublicBaseUrl(bucket, region)}/${objectKey}`,
    objectKey,
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  };
}
