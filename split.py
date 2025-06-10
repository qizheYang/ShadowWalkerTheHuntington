import os

INPUT_FILE = 'walkability_map.txt'
OUTPUT_PREFIX = 'walkability_part_'
MAX_SIZE = 80 * 1024 * 1024  # 80 MiB in bytes

def split_file(input_path, output_prefix, max_size):
    with open(input_path, 'rb') as infile:
        part_num = 1
        current_part = open(f"{output_prefix}{part_num}.txt", 'wb')
        current_size = 0

        for line in infile:
            if current_size + len(line) > max_size:
                current_part.close()
                part_num += 1
                current_part = open(f"{output_prefix}{part_num}.txt", 'wb')
                current_size = 0
            current_part.write(line)
            current_size += len(line)

        current_part.close()
    print(f"Splitting complete. Total parts: {part_num}")

# Run the function
split_file(INPUT_FILE, OUTPUT_PREFIX, MAX_SIZE)
