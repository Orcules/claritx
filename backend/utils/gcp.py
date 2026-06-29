import os
import json
import base64
import boto3
from botocore.exceptions import ClientError

def get_gcp_credentials():
    """
    Retrieves GCP credentials with a secure fallback chain:
    1. GOOGLE_APPLICATION_CREDENTIALS (already set)
    2. GOOGLE_CREDENTIALS_JSON (Base64 env var)
    3. AWS Secrets Manager (claritx/gcp-credentials)
    4. Bundled gcp_creds.json file
    """
    
    # 1. Check if already set
    if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
        # Verify it exists
        if os.path.exists(os.environ['GOOGLE_APPLICATION_CREDENTIALS']):
            return os.environ['GOOGLE_APPLICATION_CREDENTIALS']

    # 2. Try Base64 Env Var (Fastest but subject to 4KB limit)
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if creds_json:
        try:
            cred_path = "/tmp/gcp_creds_env.json"
            decoded_creds = base64.b64decode(creds_json).decode('utf-8')
            with open(cred_path, 'w') as f:
                f.write(decoded_creds)
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cred_path
            return cred_path
        except Exception as e:
            print(f"[GCP Auth] Failed to decode env var: {e}")

    # 3. Try AWS Secrets Manager (Most secure for large keys)
    secret_name = "claritx/gcp-credentials"
    region_name = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    
    try:
        session = boto3.session.Session()
        client = session.client(service_name='secretsmanager', region_name=region_name)
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
        
        if 'SecretString' in get_secret_value_response:
            secret = get_secret_value_response['SecretString']
            cred_path = "/tmp/gcp_creds_secrets.json"
            with open(cred_path, 'w') as f:
                f.write(secret)
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = cred_path
            print(f"[GCP Auth] Successfully loaded from Secrets Manager: {secret_name}")
            return cred_path
    except ClientError as e:
        # Expected if secret is not yet created
        # print(f"[GCP Auth] Secrets Manager check failed: {e}")
        pass
    except Exception as e:
        print(f"[GCP Auth] Unexpected error fetching secret: {e}")

    # 4. Fallback: Bundled gcp_creds.json
    possible_paths = [
        os.path.join(os.getcwd(), "gcp_creds.json"),
        os.path.join(os.getcwd(), "backend", "gcp_creds.json"),
        "/var/task/gcp_creds.json",
        "/var/task/backend/gcp_creds.json"
    ]
    for p in possible_paths:
        if os.path.exists(p):
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = p
            # print(f"[GCP Auth] Found bundled file: {p}")
            return p

    return None
