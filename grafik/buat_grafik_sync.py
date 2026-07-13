import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

# 1. Baca data log CSV
# Pastikan nama file sesuai dengan yang Anda miliki
csv_path = os.path.join(os.path.dirname(__file__), 'sync_logs_1783941511443.csv')
df = pd.read_csv(csv_path)

# Opsional: Kita ambil 100 siklus sinkronisasi terakhir agar grafik tidak terlalu berdesakan
# Jika ingin menampilkan semua, hapus '.tail(100)'
df_plot = df.tail(100).reset_index(drop=True)

# 2. Setup Figure dan Ukuran (Cocok untuk 1 kolom IEEE)
fig, ax1 = plt.subplots(figsize=(10, 5))

# Sumbu X adalah urutan siklus sinkronisasi (Batch)
x = np.arange(len(df_plot))

# 3. Plot Grafik Batang (Bar Chart) untuk Data yang Diterima vs Gagal di Sumbu Y Kiri
# Warna hijau merepresentasikan sukses, warna merah untuk gagal/hilang
ax1.bar(x, df_plot['records_accepted'], color='#2ca02c', label='Data Diterima (Sukses)', alpha=0.7)
ax1.bar(x, df_plot['records_failed'], bottom=df_plot['records_accepted'], color='#d62728', label='Data Gagal/Loss', alpha=0.9)

ax1.set_xlabel('Siklus Sinkronisasi ke- (Batch)', fontsize=10, fontweight='bold')
ax1.set_ylabel('Jumlah Rekaman Data (Baris)', fontsize=10, fontweight='bold', color='black')
ax1.tick_params(axis='y', labelcolor='black')

# Set batas atas Sumbu Y kiri (sedikit di atas batas maksimal records_sent)
max_records = df_plot['records_sent'].max() if not df_plot['records_sent'].empty else 100
ax1.set_ylim(0, max(max_records + 20, 120))

# 4. Plot Grafik Garis (Line Chart) untuk Durasi Latensi di Sumbu Y Kanan
ax2 = ax1.twinx()
ax2.plot(x, df_plot['sync_duration_ms'], color='#1f77b4', marker='o', markersize=4, linewidth=1.5, label='Durasi Sinkronisasi (ms)')
ax2.set_ylabel('Waktu Pemrosesan Cloud (ms)', fontsize=10, fontweight='bold', color='#1f77b4')
ax2.tick_params(axis='y', labelcolor='#1f77b4')

# Set batas atas Sumbu Y kanan (dinamis mengikuti latensi tertinggi)
max_duration = df_plot['sync_duration_ms'].max() if not df_plot['sync_duration_ms'].empty else 50
ax2.set_ylim(0, max(max_duration + 10, 50))

# 5. Kustomisasi Judul, Grid, dan Legenda ala Paper Akademik
plt.title('Evaluasi Kinerja Sinkronisasi: Validasi Zero Data Loss & Latensi Transmisi', fontsize=12, fontweight='bold')

# Menggabungkan legenda dari ax1 dan ax2 ke dalam satu kotak
lines_1, labels_1 = ax1.get_legend_handles_labels()
lines_2, labels_2 = ax2.get_legend_handles_labels()
ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc='upper left', framealpha=0.9, fontsize=9)

# Menambahkan grid yang halus agar lebih mudah dibaca
ax1.grid(True, linestyle='--', alpha=0.5)
fig.tight_layout()

# 6. Simpan output sebagai gambar beresolusi tinggi (300 DPI) untuk paper
output_filename = 'Grafik_Kinerja_Sinkronisasi_IEEE.png'
plt.savefig(output_filename, dpi=300)
print(f"Grafik berhasil disimpan sebagai: {output_filename}")

# Tampilkan grafik di layar
plt.show()