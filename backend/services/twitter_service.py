"""
Twitter/X integration service for posting cheer messages
"""
import os
import logging
import tweepy
from urllib.parse import unquote

from services.env_utils import get_env

logger = logging.getLogger(__name__)

# Twitter API credentials
CONSUMER_KEY = get_env("TWITTER_CONSUMER_KEY")
CONSUMER_SECRET = get_env("TWITTER_CONSUMER_SECRET")
ACCESS_TOKEN = get_env("TWITTER_ACCESS_TOKEN")
ACCESS_TOKEN_SECRET = get_env("TWITTER_ACCESS_TOKEN_SECRET")
# Decode Bearer Token if URL encoded
BEARER_TOKEN = unquote(get_env("TWITTER_BEARER_TOKEN", "") or "")

def get_twitter_client():
    """
    Create and return a Twitter client for posting tweets.
    Requires OAuth 1.0a credentials (Consumer Key, Consumer Secret, Access Token, Access Token Secret)
    """
    if not all([CONSUMER_KEY, CONSUMER_SECRET, ACCESS_TOKEN, ACCESS_TOKEN_SECRET]):
        logger.warning("Twitter credentials not fully configured. Tweets will not be posted.")
        return None
    
    try:
        # Use OAuth 1.0a User Context for posting tweets
        client = tweepy.Client(
            consumer_key=CONSUMER_KEY,
            consumer_secret=CONSUMER_SECRET,
            access_token=ACCESS_TOKEN,
            access_token_secret=ACCESS_TOKEN_SECRET,
            wait_on_rate_limit=True
        )
        return client
    except Exception as e:
        logger.error(f"Failed to create Twitter client: {e}")
        return None


async def post_cheer_to_twitter(fan_name: str, athlete_name: str, athlete_bib: str, message: str, nacionalidad: str = "") -> dict:
    """
    Post a cheer message to Twitter/X
    
    Returns:
        dict with 'success', 'tweet_id' or 'error'
    """
    client = get_twitter_client()
    
    if not client:
        return {
            "success": False,
            "error": "Twitter not configured. Missing Access Token and Access Token Secret."
        }
    
    # Format the tweet
    flag_emoji = get_flag_emoji(nacionalidad)
    tweet_text = f"💪 ¡Mensaje de ánimo para #{athlete_bib} {athlete_name}! {flag_emoji}\n\n\"{message}\"\n\n- {fan_name}\n\n#BackyardUltra #SantoDomingo2026 #Ultrarunning"
    
    # Ensure tweet is within character limit
    if len(tweet_text) > 280:
        # Truncate message to fit
        max_message_len = 280 - len(tweet_text) + len(message) - 3
        message_truncated = message[:max_message_len] + "..."
        tweet_text = f"💪 ¡Mensaje de ánimo para #{athlete_bib} {athlete_name}! {flag_emoji}\n\n\"{message_truncated}\"\n\n- {fan_name}\n\n#BackyardUltra #SantoDomingo2026"
    
    try:
        response = client.create_tweet(text=tweet_text)
        tweet_id = response.data['id']
        logger.info(f"Tweet posted successfully: {tweet_id}")
        return {
            "success": True,
            "tweet_id": tweet_id,
            "tweet_url": f"https://twitter.com/i/web/status/{tweet_id}"
        }
    except tweepy.TweepyException as e:
        error_msg = str(e)
        logger.error(f"Failed to post tweet: {error_msg}")
        
        # Check for common errors
        if "401" in error_msg:
            logger.error("401 Unauthorized - Check if: 1) App has Read and Write permissions, 2) Access Token was generated AFTER enabling write permissions, 3) Credentials are correct")
        elif "403" in error_msg:
            logger.error("403 Forbidden - The app may be in read-only mode or the account is suspended")
        
        return {
            "success": False,
            "error": error_msg
        }


def get_flag_emoji(nacionalidad: str) -> str:
    """Convert country code to flag emoji"""
    flags = {
        "DOM": "🇩🇴",
        "COL": "🇨🇴",
        "VEN": "🇻🇪",
        "MEX": "🇲🇽",
        "USA": "🇺🇸",
        "ARG": "🇦🇷",
        "BRA": "🇧🇷",
        "FRA": "🇫🇷",
        "ESP": "🇪🇸",
        "GUA": "🇬🇹",
        "HAI": "🇭🇹",
        "PER": "🇵🇪",
        "JAP": "🇯🇵",
    }
    return flags.get(nacionalidad, "🏃")


def check_twitter_config() -> dict:
    """Check if Twitter is properly configured"""
    return {
        "consumer_key": bool(CONSUMER_KEY),
        "consumer_secret": bool(CONSUMER_SECRET),
        "access_token": bool(ACCESS_TOKEN),
        "access_token_secret": bool(ACCESS_TOKEN_SECRET),
        "bearer_token": bool(BEARER_TOKEN),
        "can_post": bool(CONSUMER_KEY and CONSUMER_SECRET and ACCESS_TOKEN and ACCESS_TOKEN_SECRET)
    }
