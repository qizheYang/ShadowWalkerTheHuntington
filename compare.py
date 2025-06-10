import numpy as np
import os

def load_and_upscale(filename, scale_factor=10):
    """
    Load and upscale a shade_txt/MMHH.txt file to match walkability resolution.
    """
    try:
        lowres = np.loadtxt(filename, dtype=int)
    except Exception as e:
        print(f"[ERROR] Failed to load low-res file {filename}: {e}")
        return None

    upscaled = np.repeat(np.repeat(lowres, scale_factor, axis=0), scale_factor, axis=1)
    return upscaled

def compare_upscaled_with_precomputed(month: int, hour: int):
    base_name = f"{month:02d}{hour:02d}.txt"
    lowres_path = f"shade_txt/{base_name}"
    precomputed_path = f"upscale/{base_name}"

    print(f"\n🔍 Comparing {base_name}...")

    # Load on-the-fly upscaled version
    upscaled = load_and_upscale(lowres_path)
    if upscaled is None:
        print("[SKIP] Could not load low-res source.")
        return

    # Load precomputed version
    try:
        precomputed = np.loadtxt(precomputed_path, dtype=int)
    except Exception as e:
        print(f"[ERROR] Failed to load precomputed file {precomputed_path}: {e}")
        return

    # Check shape
    if upscaled.shape != precomputed.shape:
        print(f"[FAIL ❌] Shape mismatch: {upscaled.shape} vs {precomputed.shape}")
        return

    # Check content
    if np.array_equal(upscaled, precomputed):
        print("[PASS ✅] Upscaled matches precomputed exactly.")
    else:
        mismatch_count = np.sum(upscaled != precomputed)
        total = upscaled.size
        print(f"[FAIL ❌] {mismatch_count} mismatches out of {total} values.")
        mismatch_indices = np.argwhere(upscaled != precomputed)
        print(f"[INFO] First few mismatches at (row, col): {mismatch_indices[:5]}")

# EXAMPLE: Loop through all files in shade_txt/
for fname in os.listdir("shade_txt"):
    if fname.endswith(".txt") and len(fname) == 8:
        try:
            month = int(fname[:2])
            hour = int(fname[2:4])
            compare_upscaled_with_precomputed(month, hour)
        except:
            continue
