import { AllConfigType } from '@/config/config.type';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export type CloudinaryResourceType = 'image' | 'raw';

export type CloudinaryUploadSignature = {
  apiKey: string;
  cloudName: string;
  resourceType: CloudinaryResourceType;
  timestamp: number;
  signature: string;
  publicId: string;
  deliveryType: 'authenticated';
  uploadUrl: string;
  uploadPreset: string;
};

export type VerifiedCloudinaryAsset = {
  bytes: number;
  format: string;
};

type CloudinaryAssetResponse = {
  public_id?: unknown;
  resource_type?: unknown;
  type?: unknown;
  bytes?: unknown;
  format?: unknown;
};

type CloudinaryConfigValues = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
};

const SIGNED_URL_DURATION_SECONDS = 300;

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  createUploadSignature(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): CloudinaryUploadSignature {
    const config = this.getConfig();
    this.configure(config);
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      overwrite: 'false',
      public_id: publicId,
      timestamp: String(timestamp),
      type: 'authenticated',
      upload_preset: config.uploadPreset,
      allowed_formats: 'jpg,png,webp,pdf',
    };

    return {
      apiKey: config.apiKey,
      cloudName: config.cloudName,
      resourceType,
      timestamp,
      signature: cloudinary.utils.api_sign_request(
        paramsToSign,
        config.apiSecret,
      ),
      publicId,
      deliveryType: 'authenticated',
      uploadPreset: config.uploadPreset,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`,
    };
  }

  async verifyUploadedAsset(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<VerifiedCloudinaryAsset> {
    const config = this.getConfig();
    this.configure(config);

    let response: unknown;
    try {
      response = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        type: 'authenticated',
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'http_code' in error &&
        error.http_code === 404
      ) {
        throw new BadRequestException(
          'The uploaded file could not be found in Cloudinary.',
        );
      }

      throw new ServiceUnavailableException(
        'Could not verify the uploaded file with Cloudinary.',
        { cause: error },
      );
    }

    if (typeof response !== 'object' || response === null) {
      throw new ServiceUnavailableException(
        'Cloudinary returned an invalid asset response.',
      );
    }

    const asset = response as CloudinaryAssetResponse;
    if (
      asset.public_id !== publicId ||
      asset.resource_type !== resourceType ||
      asset.type !== 'authenticated' ||
      typeof asset.bytes !== 'number' ||
      !Number.isInteger(asset.bytes) ||
      typeof asset.format !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'Cloudinary asset metadata did not match the signed upload.',
      );
    }

    return { bytes: asset.bytes, format: asset.format.toLowerCase() };
  }

  async deleteAsset(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<void> {
    const config = this.getConfig();
    this.configure(config);
    const result = (await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      invalidate: true,
    })) as { result?: unknown };

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new ServiceUnavailableException(
        'Cloudinary did not confirm deletion of the attachment.',
      );
    }
  }

  createDeliveryUrl(
    publicId: string,
    format: string,
    resourceType: CloudinaryResourceType,
  ): string {
    const config = this.getConfig();
    this.configure(config);
    const expiresAt =
      Math.floor(Date.now() / 1000) + SIGNED_URL_DURATION_SECONDS;

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: 'authenticated',
      expires_at: expiresAt,
    });
  }

  private configure(config: CloudinaryConfigValues): void {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  private getConfig(): CloudinaryConfigValues {
    const cloudinaryConfig = this.configService.get('cloudinary', {
      infer: true,
    });
    const cloudName = cloudinaryConfig?.cloudName;
    const apiKey = cloudinaryConfig?.apiKey;
    const apiSecret = cloudinaryConfig?.apiSecret;
    const uploadPreset = cloudinaryConfig?.uploadPreset;
    if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
      throw new ServiceUnavailableException(
        'Cloudinary credentials and the signed task-attachment upload preset must be configured.',
      );
    }

    return { cloudName, apiKey, apiSecret, uploadPreset };
  }
}
