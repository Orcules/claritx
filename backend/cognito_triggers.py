import json

def handler(event, context):
    """
    Cognito PreSignUp trigger to auto-confirm users.
    This bypasses email verification entirely.
    """
    # Auto-confirm the user
    event['response']['autoConfirmUser'] = True
    
    # Auto-verify the email
    event['response']['autoVerifyEmail'] = True
    
    return event
