import os

# Define the relative path
base_path = './data/'

# Create the base directory if it doesn't exist
os.makedirs(base_path, exist_ok=True)

# Create folders named 001 to 016
for i in range(1, 17):
    folder_name = f"{i:03}"  # Format the number as 3 digits
    folder_path = os.path.join(base_path, folder_name)
    if not os.path.exists(folder_path):  # Check if the folder already exists
        os.makedirs(folder_path)
        print(f"Created folder: {folder_name}")
    else:
        print(f"Skipped existing folder: {folder_name}")

print("Operation completed.")