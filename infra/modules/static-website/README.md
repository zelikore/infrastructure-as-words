# Static Website Module

Deploys an S3 + CloudFront static website with DNS and certificate management.

Key behavior:

- Private S3 origin with CloudFront OAC
- TLS certificate in `us-east-1` for CloudFront
- Route53 A/AAAA aliases for the site domain
- Security headers + cache policies
- Optional CloudFront rewrite function for exported SPAs
