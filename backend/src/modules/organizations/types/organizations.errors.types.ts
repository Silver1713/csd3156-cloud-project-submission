export class OrganizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationError";
  }
}

export class OrganizationNotFoundError extends OrganizationError {
  constructor() {
    super("Organization not found");
    this.name = "OrganizationNotFoundError";
  }
}

export class OrganizationAccessContextNotFoundError extends OrganizationError {
  constructor() {
    super("Organization access context not found for account");
    this.name = "OrganizationAccessContextNotFoundError";
  }
}

export class OrganizationPermissionDeniedError extends OrganizationError {
  constructor(message = "Organization permissions are required for this action") {
    super(message);
    this.name = "OrganizationPermissionDeniedError";
  }
}

export class OrganizationDeleteBlockedError extends OrganizationError {
  constructor() {
    super("Organization cannot be deleted while related records still exist");
    this.name = "OrganizationDeleteBlockedError";
  }
}
