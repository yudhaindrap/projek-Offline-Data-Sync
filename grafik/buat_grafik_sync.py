import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

# 1. Konfigurasi Font Standar IEEE (Times New Roman)
plt.rcParams["font.family"] = "Times New Roman"
plt.rcParams["font.size"] = 10 # Ukuran font standar yang tetap terbaca saat diperkecil

# 2. Baca data log CSV
csv_path = os.path.join(os.path.dirname(__file__), 'sync_logs_1783941511443.csv')
df = pd.read_csv(csv_path)

# Ambil 100 siklus terakhir
df_plot = df.tail(100).reset_index(drop=True)

# 3. Setup Figure
# Ukuran 7x4 inci dengan rasio yang bagus saat diskalakan ke 1 kolom IEEE (3.5 inci)
fig, ax1 = plt.subplots(figsize=(7, 4))
x = np.arange(len(df_plot))

# 4. Bar Chart (Data Rekaman) - Dioptimalkan untuk cetak Hitam-Putih
# Menggunakan warna abu-abu/putih dengan tepi hitam (edgecolor) dan arsiran (hatch)
ax1.bar(x, df_plot['records_accepted'], color='#FFFFFF', edgecolor='black', 
        hatch='///', label='Data Accepted', alpha=0.9)
ax1.bar(x, df_plot['records_failed'], bottom=df_plot['records_accepted'], 
        color='#A0A0A0', edgecolor='black', hatch='\\\\\\', label='Data Failed', alpha=0.9)

ax1.set_xlabel('Synchronization Cycle (Batch)', fontweight='bold')
ax1.set_ylabel('Number of Records (Rows)', fontweight='bold')
ax1.tick_params(axis='y')

# Set batas atas Sumbu Y kiri
max_records = df_plot['records_sent'].max() if not df_plot['records_sent'].empty else 100
ax1.set_ylim(0, max(max_records + 20, 120))

# 5. Line Chart (Latensi) - Sumbu Y Kanan
ax2 = ax1.twinx()
# Menggunakan garis hitam pekat dengan marker segitiga (^) yang menonjol
ax2.plot(x, df_plot['sync_duration_ms'], color='black', marker='^', markersize=4, 
         linestyle='-', linewidth=1.5, label='Sync Latency (ms)')

ax2.set_ylabel('Cloud Processing Time (ms)', fontweight='bold')
ax2.tick_params(axis='y')

# Set batas atas Sumbu Y kanan
max_duration = df_plot['sync_duration_ms'].max() if not df_plot['sync_duration_ms'].empty else 50
ax2.set_ylim(0, max(max_duration + 10, 50))

# 6. Kustomisasi Legenda dan Grid
# Hapus judul atas karena di IEEE judul gambar diletakkan di "Figure Caption" di bawah gambar, bukan di dalam grafik.
# plt.title(...) -> Dihapus untuk standar IEEE.

# Gabung legenda
lines_1, labels_1 = ax1.get_legend_handles_labels()
lines_2, labels_2 = ax2.get_legend_handles_labels()
ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc='upper left', framealpha=1.0, edgecolor='black', fontsize=9)

# Grid halus
ax1.grid(True, linestyle=':', alpha=0.6, color='gray')

# Gunakan tight_layout agar tidak ada ruang putih terbuang yang membuat font mengecil
fig.tight_layout()

# 7. Ekspor Resolusi Tinggi untuk Publikasi
output_filename = 'Fig_Sync_Performance_IEEE.png'
# bbox_inches='tight' memastikan batas tepi gambar dipotong rapi
plt.savefig(output_filename, dpi=300, bbox_inches='tight')
print(f"Grafik standar IEEE berhasil disimpan sebagai: {output_filename}")

# plt.show()