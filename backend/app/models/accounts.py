from datetime import datetime, timezone
from app.extensions import get_db

def utc_now():
    return datetime.now(timezone.utc)


"""
This function saves an account to the database.
It takes the following parameters:
- data: a dictionary containing the account data
- user_id: the ID of the user who owns the account
- plaid_item_id: the ID of the Plaid item that the account belongs to

It returns the following:
- The account document
"""
def save_account(data, user_id, item_id):
    """Save an account to the database."""
    accounts_collection = get_db()["Accounts"]

    doc = {
        "userId": str(user_id),
        "itemId": item_id,
        "plaidAccountId": data["account_id"],
        "name": data["name"],
        "officialName": data["official_name"],
        "type": data["type"],
        "subtype": data["subtype"],
        "mask": data["mask"],
        "holderCategory": data["holder_category"],
        "availableBalance": data["balances"]["available"],
        "currentBalance": data["current_balance"],
        "limit": data["limit"],
        "isoCurrencyCode": data["iso_currency_code"],
        "unofficialCurrencyCode": data["unofficial_currency_code"],
        "createdAt": utc_now(),
        "updatedAt": utc_now()
    }
    return accounts_collection.insert_one(doc)

"""
This function gets an account from the database by the user ID and the Plaid account ID.
It takes the following parameters:
- user_id: the ID of the user who owns the account
- plaid_account_id: the ID of the Plaid account

It returns the following:
- The account document
"""
def get_account_by_id(user_id, plaid_account_id):
    """Get an account from the database."""
    accounts_collection = get_db()["Accounts"]  
    result = accounts_collection.find_one({"userId": str(user_id), "plaidAccountId": plaid_account_id})
    return result

"""
This function gets all accounts from the database by the user ID.
It takes the following parameters:
- user_id: the ID of the user who owns the accounts

It returns the following:
- A list of account documents
"""
def get_accounts_by_user_id(user_id):
    """Get all accounts from the database."""
    accounts_collection = get_db()["Accounts"]
    result = accounts_collection.find({"userId": str(user_id)})
    return list(result)

