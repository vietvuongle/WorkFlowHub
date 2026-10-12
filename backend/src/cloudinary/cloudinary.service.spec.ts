import { AllConfigType } from '@/config/config.type';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  const config = {
    cloudName: 'test-cloud',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    uploadPreset: 'task-attachments',
  };
  let service: CloudinaryService;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(config),
    } as unknown as ConfigService<AllConfigType>;
    service = new CloudinaryService(configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs an authenticated upload using the configured preset', () => {
    const signRequest = jest
      .spyOn(cloudinary.utils, 'api_sign_request')
      .mockReturnValue('cloudinary-signature');

    const result = service.createUploadSignature(
      'workflowhub/task/file',
      'raw',
    );

    expect(signRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        overwrite: 'false',
        public_id: 'workflowhub/task/file',
        timestamp: expect.any(String),
        type: 'authenticated',
        upload_preset: 'task-attachments',
        allowed_formats: 'jpg,png,webp,pdf',
      }),
      'test-api-secret',
    );
    expect(result).toEqual(
      expect.objectContaining({
        apiKey: 'test-api-key',
        cloudName: 'test-cloud',
        resourceType: 'raw',
        deliveryType: 'authenticated',
        uploadPreset: 'task-attachments',
        signature: 'cloudinary-signature',
      }),
    );
  });

  it('generates an expiring private download URL', () => {
    const privateDownloadUrl = jest
      .spyOn(cloudinary.utils, 'private_download_url')
      .mockReturnValue('https://cloudinary.example/temporary');

    const result = service.createDeliveryUrl(
      'workflowhub/task/file',
      'pdf',
      'raw',
    );

    expect(privateDownloadUrl).toHaveBeenCalledWith(
      'workflowhub/task/file',
      'pdf',
      expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: expect.any(Number),
      }),
    );
    expect(result).toBe('https://cloudinary.example/temporary');
  });

  it('fails explicitly when Cloudinary is not configured', () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService<AllConfigType>;
    const unconfiguredService = new CloudinaryService(configService);

    expect(() =>
      unconfiguredService.createUploadSignature('public-id', 'image'),
    ).toThrow(ServiceUnavailableException);
  });
});
