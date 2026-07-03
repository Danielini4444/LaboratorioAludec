# Exporta la tabla Equipos del Access viejo a equipos.json (junto a este script).
# Uso: powershell -File exportar-equipos.ps1 "ruta\al\Ensayos_Mexico_Backup.mdb"
param([Parameter(Mandatory = $true)][string]$Mdb)

$conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$Mdb;Mode=Read")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Equipo, Referencia FROM [Equipos]"
$da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
[void]$da.Fill($dt)
$conn.Close()

$equipos = @()
foreach ($fila in $dt.Rows) {
  $equipos += [pscustomobject]@{
    nombre             = ([string]$fila.Equipo).Trim()
    referencia_interna = ([string]$fila.Referencia).Trim()
  }
}
$destino = Join-Path $PSScriptRoot "equipos.json"
$equipos | ConvertTo-Json | Out-File -Encoding utf8 $destino
Write-Output "exportados $($equipos.Count) equipos a $destino"
