import os
import re

INPUT_PREFIX = 'walkability_part_'
OUTPUT_FILE = 'walkability_map.txt'

def natural_sort_key(name):
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split(r'(\d+)', name)]

def combine_files(input_prefix, output_path):
    files = [f for f in os.listdir('.') if f.startswith(input_prefix) and f.endswith('.txt')]
    files.sort(key=natural_sort_key)  # Ensures proper numeric order

    with open(output_path, 'wb') as outfile:
        for filename in files:
            print(f"Appending {filename}...")
            with open(filename, 'rb') as infile:
                outfile.write(infile.read())

    print(f"Recombined into: {output_path}")

# Run the function
combine_files(INPUT_PREFIX, OUTPUT_FILE)
