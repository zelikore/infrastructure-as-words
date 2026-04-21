import type { ModuleCatalogEntry } from "@infrastructure-as-words/contracts";

export const platformModuleCatalog: ModuleCatalogEntry[] = [
  {
    moduleId: "iaw-shared-auth",
    label: "Shared Auth Domain",
    source: "./infra/modules/shared-auth",
    visibility: "private",
    priority: "preferred",
    description:
      "Shared Cognito user pool, SSM-backed admin bootstrap, and custom auth domain baseline.",
    category: "identity",
    required: false,
    capabilities: ["cognito", "oauth", "custom-domain"],
    documentation: {
      summary: "Creates a shared Cognito user pool and custom auth domain.",
      howItWorks:
        "This module provisions Cognito, a shared admin SSM parameter, a seeded admin user, OAuth scopes, ACM certificates, and Route53 aliases for a single shared identity plane that can be consumed by multiple environments.",
      usageNotes:
        "Use one shared deployment and reference outputs from app stacks through remote state.",
    },
  },
  {
    moduleId: "iaw-cognito-web-client",
    label: "Cognito Web Client",
    source: "./infra/modules/cognito-web-client",
    visibility: "private",
    priority: "preferred",
    description: "Environment web app OAuth client for the shared user pool.",
    category: "identity",
    required: false,
    capabilities: ["oauth-client", "pkce", "hosted-ui"],
    documentation: {
      summary: "Creates a Cognito user pool client per environment.",
      howItWorks:
        "This module configures OAuth code flow, callback/logout URLs, token validity, and app scopes for a browser SPA connected to the shared user pool.",
      usageNotes:
        "Provide callback/logout URLs for each environment domain and localhost development.",
    },
  },
  {
    moduleId: "iaw-app-environment",
    label: "App Environment",
    source: "./infra/modules/app-environment",
    visibility: "private",
    priority: "preferred",
    description:
      "Full SPA platform composition for shared auth, API, storage, observability, SSM-backed admin config, and edge delivery.",
    category: "platform",
    required: false,
    capabilities: [
      "spa",
      "api",
      "cognito",
      "cloudfront",
      "dynamodb",
      "s3",
      "observability",
    ],
    documentation: {
      summary:
        "Composes the full application environment used by this repository.",
      howItWorks:
        "This module composes the submission data plane, environment-specific Cognito web client, Lambda HTTP API, observability suite, and static website edge stack into one reusable environment baseline while sourcing the admin identity from the shared auth stack.",
      usageNotes:
        "Use this as the default private module when teams need a complete browser application platform.",
    },
  },
  {
    moduleId: "iaw-observability-suite",
    label: "Observability Suite",
    source: "./infra/modules/observability-suite",
    visibility: "private",
    priority: "preferred",
    description:
      "CloudWatch alarms, dashboard, and SNS notifications for application health.",
    category: "observability",
    required: false,
    capabilities: ["cloudwatch", "alarms", "dashboard", "sns", "logging"],
    documentation: {
      summary:
        "Creates the operational visibility baseline for an environment.",
      howItWorks:
        "This module provisions Lambda, API Gateway, and DynamoDB alarms, an SNS alert topic with subscriptions, and a CloudWatch dashboard that centralizes the core health metrics.",
      usageNotes:
        "Use alongside service and data modules so operators can open a single dashboard and receive alert notifications when health thresholds are crossed.",
    },
  },
  {
    moduleId: "iaw-submission-data",
    label: "Submission Data Plane",
    source: "./infra/modules/submission-data",
    visibility: "private",
    priority: "preferred",
    description:
      "Submission persistence with encrypted DynamoDB and artifact S3.",
    category: "data",
    required: false,
    capabilities: ["dynamodb", "s3", "artifact-storage"],
    documentation: {
      summary:
        "Creates DynamoDB and S3 storage for request history and artifacts.",
      howItWorks:
        "This module creates a pay-per-request DynamoDB table with PITR and an encrypted private S3 bucket for generated artifacts. It returns ARNs and names for API integration.",
      usageNotes:
        "Use environment-specific naming to isolate dev and prod data.",
    },
  },
  {
    moduleId: "iaw-http-api-service",
    label: "Lambda HTTP API",
    source: "./infra/modules/http-api-service",
    visibility: "private",
    priority: "preferred",
    description:
      "JWT-protected HTTP API with Lambda, API custom domain, structured logging, and SSM-backed admin runtime lookup.",
    category: "compute",
    required: false,
    capabilities: [
      "lambda",
      "apigateway",
      "jwt-auth",
      "custom-domain",
      "structured-logging",
    ],
    documentation: {
      summary: "Deploys Lambda + API Gateway HTTP API with Cognito JWT auth.",
      howItWorks:
        "This module provisions Lambda execution role, API Gateway routes, JWT authorizer, access logging, custom API domain, and Route53 records. It wires DynamoDB, S3, Bedrock permissions, observability environment metadata, and the shared admin SSM parameter into Lambda.",
      usageNotes:
        "Provide Cognito issuer/audience and explicit route scopes for read/write boundaries.",
    },
  },
  {
    moduleId: "iaw-static-website",
    label: "Static Website Edge",
    source: "./infra/modules/static-website",
    visibility: "private",
    priority: "preferred",
    description: "S3 + CloudFront + ACM + Route53 static SPA hosting baseline.",
    category: "edge",
    required: false,
    capabilities: ["s3", "cloudfront", "route53", "acm", "spa-rewrite"],
    documentation: {
      summary: "Hosts static SPA exports behind CloudFront and S3.",
      howItWorks:
        "This module provisions an encrypted private bucket, CloudFront with OAC, response headers policies, ACM certificate in us-east-1, and Route53 aliases for the app domain.",
      usageNotes:
        "Use the rewrite function to map extensionless paths to exported HTML routes.",
    },
  },
  {
    moduleId: "iaw-docs-website",
    label: "Docs Website",
    source: "./infra/modules/docs-website",
    visibility: "private",
    priority: "allowed",
    description:
      "Opinionated static website wrapper for docs and marketing sites.",
    category: "delivery",
    required: false,
    capabilities: ["docs", "marketing", "static-site", "cloudfront"],
    documentation: {
      summary:
        "Composes the static website baseline with a simpler docs-site CSP profile.",
      howItWorks:
        "This module wraps the static website edge stack and applies defaults suitable for brochure, docs, release-note, and marketing sites that do not need API or auth connectivity.",
      usageNotes:
        "Use when a site only needs static delivery and content publishing.",
    },
  },
  {
    moduleId: "iaw-example-static-website",
    label: "Example Static Website Stack",
    source: "./infra/modules/example-static-website",
    visibility: "private",
    priority: "allowed",
    description: "Composable example stack for marketing/docs static sites.",
    category: "delivery",
    required: false,
    capabilities: ["example", "static-site", "cloudfront"],
    documentation: {
      summary: "Reference composition module for static example websites.",
      howItWorks:
        "This module composes the static website baseline with opinionated defaults for quickly launching example website environments.",
      usageNotes:
        "Useful for demos, docs sites, and low-complexity landing pages.",
    },
  },
  {
    moduleId: "iaw-example-website-with-api",
    label: "Example Website Platform Stack",
    source: "./infra/modules/example-website-with-api",
    visibility: "private",
    priority: "allowed",
    description:
      "Composable example stack for SPA + API + persistence websites.",
    category: "delivery",
    required: false,
    capabilities: ["example", "spa", "api", "persistence"],
    documentation: {
      summary: "Reference composition module for websites that need APIs.",
      howItWorks:
        "This module composes shared auth client, data plane, API service, and static website delivery into a single reusable stack pattern for internal platforms.",
      usageNotes:
        "Use when teams need a working full-stack baseline with governed modules.",
    },
  },
  {
    moduleId: "terraform-aws-vpc",
    label: "VPC Baseline",
    source: "terraform-aws-modules/vpc/aws",
    visibility: "public",
    priority: "allowed",
    description: "Public VPC module for subnet and route composition.",
    category: "network",
    required: false,
    capabilities: ["vpc", "subnets", "routing"],
    documentation: {
      summary: "Community VPC baseline module.",
      howItWorks:
        "Provides reusable VPC primitives including subnet tiers, NAT options, route tables, and security baseline building blocks.",
      usageNotes:
        "Use as a fallback when private network modules are unavailable.",
    },
  },
  {
    moduleId: "terraform-aws-lambda",
    label: "Lambda Service",
    source: "terraform-aws-modules/lambda/aws",
    visibility: "public",
    priority: "allowed",
    description: "Public Lambda deployment module.",
    category: "compute",
    required: false,
    capabilities: ["lambda", "packaging"],
    documentation: {
      summary: "Community Lambda packaging and deployment module.",
      howItWorks:
        "Packages source artifacts and manages Lambda function settings, IAM roles, and optional integrations with event sources and layers.",
      usageNotes:
        "Prefer private service modules first; use as an approved fallback.",
    },
  },
  {
    moduleId: "terraform-aws-apigateway-v2",
    label: "HTTP API",
    source: "terraform-aws-modules/apigateway-v2/aws",
    visibility: "public",
    priority: "allowed",
    description: "Public API Gateway v2 module for HTTP APIs.",
    category: "edge",
    required: false,
    capabilities: ["apigateway", "http-api", "routing"],
    documentation: {
      summary: "Community API Gateway v2 module.",
      howItWorks:
        "Creates HTTP API routes, integrations, optional authorizers, and stage settings for public or internal API delivery.",
      usageNotes: "Use when private API baseline modules are not available.",
    },
  },
  {
    moduleId: "terraform-aws-s3-bucket",
    label: "S3 Bucket",
    source: "terraform-aws-modules/s3-bucket/aws",
    visibility: "public",
    priority: "allowed",
    description: "Public S3 module for encrypted bucket policy patterns.",
    category: "data",
    required: false,
    capabilities: ["s3", "encryption", "bucket-policy"],
    documentation: {
      summary: "Community S3 bucket module.",
      howItWorks:
        "Creates S3 buckets with versioning, encryption, access controls, and policy options for common storage and artifact scenarios.",
      usageNotes:
        "Use with explicit public-access-block and encryption controls.",
    },
  },
  {
    moduleId: "terraform-aws-dynamodb-table",
    label: "DynamoDB Table",
    source: "terraform-aws-modules/dynamodb-table/aws",
    visibility: "public",
    priority: "allowed",
    description:
      "Public DynamoDB table module for metadata and history records.",
    category: "data",
    required: false,
    capabilities: ["dynamodb", "nosql", "history-storage"],
    documentation: {
      summary: "Community DynamoDB table module.",
      howItWorks:
        "Creates provisioned or on-demand DynamoDB tables with index configuration, PITR, and optional autoscaling controls.",
      usageNotes:
        "Align partition/sort keys with access patterns before generation.",
    },
  },
];
