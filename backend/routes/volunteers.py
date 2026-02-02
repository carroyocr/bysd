from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()

# ============================================================================
# HARDCODED DATA - Embedded from Excel files
# ============================================================================

ASSIGNMENTS_DATA = [
    {"id": 1, "puesto": "Área de Carpas / Zona de Atletas", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "anajuliasepulvedar@gmail.com"},
    {"id": 2, "puesto": "Área de Carpas / Zona de Atletas", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "anajuliasepulvedar@gmail.com"},
    {"id": 3, "puesto": "Área de Carpas / Zona de Atletas", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": "anajuliasepulvedar@gmail.com"},
    {"id": 4, "puesto": "Área de Carpas / Zona de Atletas", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": "veronica.ccuevas@gmail.com"},
    {"id": 5, "puesto": "Área de Carpas / Zona de Atletas", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": None},
    {"id": 6, "puesto": "Área de Carpas / Zona de Atletas", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": None},
    {"id": 7, "puesto": "Área de Carpas / Zona de Atletas", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": None},
    {"id": 8, "puesto": "Centro de Información y Redes", "turno": "A", "dia": "2026-01-24", "hora_inicio": "06:00:00", "hora_fin": "08:30:00", "slot": 1, "email_asignado": "attysshm@gmail.com"},
    {"id": 9, "puesto": "Centro de Información y Redes", "turno": "A", "dia": "2026-01-24", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "uzielemilio21@gmail.com"},
    {"id": 10, "puesto": "Centro de Información y Redes", "turno": "A", "dia": "2026-01-24", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": "carolinazapata8@gmail.com"},
    {"id": 11, "puesto": "Centro de Información y Redes", "turno": "A", "dia": "2026-01-24", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": "geizel26@gmail.com"},
    {"id": 12, "puesto": "Centro de Información y Redes", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "uzielemilio21@gmail.com"},
    {"id": 13, "puesto": "Centro de Información y Redes", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": "geizel26@gmail.com"},
    {"id": 14, "puesto": "Centro de Información y Redes", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": None},
    {"id": 15, "puesto": "Centro de Información y Redes", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": None},
    {"id": 16, "puesto": "Centro de Información y Redes", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": None},
    {"id": 17, "puesto": "Centro de Información y Redes", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "geizel26@gmail.com"},
    {"id": 18, "puesto": "Control de Vueltas", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "jessejunior22@gmail.com"},
    {"id": 19, "puesto": "Control de Vueltas", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": "miguelangel104@hotmail.com"},
    {"id": 20, "puesto": "Control de Vueltas", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "carolinazapata8@gmail.com"},
    {"id": 21, "puesto": "Control de Vueltas", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 2, "email_asignado": "loren216454@gmail.com"},
    {"id": 22, "puesto": "Control de Vueltas", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": None},
    {"id": 23, "puesto": "Control de Vueltas", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": "laurajavier1816@gmail.com"},
    {"id": 24, "puesto": "Control de Vueltas", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": None},
    {"id": 25, "puesto": "Control de Vueltas", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": None},
    {"id": 26, "puesto": "Control de Vueltas", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "minaya9507@gmail.com"},
    {"id": 27, "puesto": "Corral de salida y animación", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "daurisme@gmail.com"},
    {"id": 28, "puesto": "Corral de salida y animación", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": "gabrieldcm1000@gmail.com"},
    {"id": 29, "puesto": "Corral de salida y animación", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 3, "email_asignado": "danio286@gmail.com"},
    {"id": 30, "puesto": "Corral de salida y animación", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 4, "email_asignado": "annaoc1107@gmail.com"},
    {"id": 31, "puesto": "Corral de salida y animación", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "daurisme@gmail.com"},
    {"id": 32, "puesto": "Corral de salida y animación", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 2, "email_asignado": "rafaelsuazoh@gmail.com"},
    {"id": 33, "puesto": "Corral de salida y animación", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 3, "email_asignado": "annaoc1107@gmail.com"},
    {"id": 34, "puesto": "Hidratación y Snacks", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 6, "email_asignado": "elianacalderonmena@gmail.com"},
    {"id": 35, "puesto": "Corral de salida y animación", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": "rafaelsuazoh@gmail.com"},
    {"id": 36, "puesto": "Corral de salida y animación", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 2, "email_asignado": "minaya9507@gmail.com"},
    {"id": 37, "puesto": "Corral de salida y animación", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": "rafaelsuazoh@gmail.com"},
    {"id": 38, "puesto": "Corral de salida y animación", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 4, "email_asignado": "elianacalderonmena@gmail.com"},
    {"id": 39, "puesto": "Corral de salida y animación", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": "ronald.dbtc@gmail.com"},
    {"id": 40, "puesto": "Corral de salida y animación", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 2, "email_asignado": None},
    {"id": 41, "puesto": "Corral de salida y animación", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": None},
    {"id": 42, "puesto": "Corral de salida y animación", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 2, "email_asignado": "ronald.dbtc@gmail.com"},
    {"id": 43, "puesto": "Corral de salida y animación", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 2, "email_asignado": "elianacalderonmena@gmail.com"},
    {"id": 44, "puesto": "Corral de salida y animación", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": None},
    {"id": 45, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "dattotilia57@gmail.com"},
    {"id": 46, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "contrerasgeorgina@gmail.com"},
    {"id": 47, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": "contrerasgeorgina@gmail.com"},
    {"id": 48, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": "annaoc1107@gmail.com"},
    {"id": 49, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": None},
    {"id": 50, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": "laurajavier1816@gmail.com"},
    {"id": 51, "puesto": "Equipo Médico / Apoyo Seguridad", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": None},
    {"id": 52, "puesto": "Hidratación y Snacks", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "eduardogarciapallares7@gmail.com"},
    {"id": 53, "puesto": "Hidratación y Snacks", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": "eduardogarciapallares7@gmail.com"},
    {"id": 54, "puesto": "Hidratación y Snacks", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 3, "email_asignado": "sordehiperez@gmail.com"},
    {"id": 55, "puesto": "Hidratación y Snacks", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 4, "email_asignado": "alexamperegrina@gmail.com"},
    {"id": 56, "puesto": "Hidratación y Snacks", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 5, "email_asignado": "ritarodriguezlara@gmail.com"},
    {"id": 57, "puesto": "Corral de salida y animación", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "elianacalderonmena@gmail.com"},
    {"id": 58, "puesto": "Hidratación y Snacks", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "eduardogarciapallares7@gmail.com"},
    {"id": 59, "puesto": "Hidratación y Snacks", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 2, "email_asignado": "eduardogarciapallares7@gmail.com"},
    {"id": 60, "puesto": "Hidratación y Snacks", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 3, "email_asignado": "miguelina.vasquez@gmail.com"},
    {"id": 61, "puesto": "Hidratación y Snacks", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 4, "email_asignado": "johangalvan18@gmail.com"},
    {"id": 62, "puesto": "Hidratación y Snacks", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 5, "email_asignado": "sketchjose99@gmail.com"},
    {"id": 63, "puesto": "Hidratación y Snacks", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": "laurajavier1816@gmail.com"},
    {"id": 64, "puesto": "Hidratación y Snacks", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 2, "email_asignado": "johangalvan18@gmail.com"},
    {"id": 65, "puesto": "Hidratación y Snacks", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 3, "email_asignado": "veronica.ccuevas@gmail.com"},
    {"id": 66, "puesto": "Hidratación y Snacks", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": None},
    {"id": 67, "puesto": "Hidratación y Snacks", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 2, "email_asignado": None},
    {"id": 68, "puesto": "Hidratación y Snacks", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": None},
    {"id": 69, "puesto": "Hidratación y Snacks", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 2, "email_asignado": None},
    {"id": 70, "puesto": "Hidratación y Snacks", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": None},
    {"id": 71, "puesto": "Hidratación y Snacks", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 2, "email_asignado": None},
    {"id": 72, "puesto": "Hidratación y Snacks", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "sketchjose99@gmail.com"},
    {"id": 73, "puesto": "Orden y Limpieza", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": "contrerasgeorgina@gmail.com"},
    {"id": 74, "puesto": "Orden y Limpieza", "turno": "A", "dia": "2026-01-24", "hora_inicio": "07:30:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": "minaya9507@gmail.com"},
    {"id": 75, "puesto": "Orden y Limpieza", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 1, "email_asignado": "cfmateus07@gmail.com"},
    {"id": 76, "puesto": "Orden y Limpieza", "turno": "B", "dia": "2026-01-24", "hora_inicio": "12:00:00", "hora_fin": "16:00:00", "slot": 2, "email_asignado": "menciacb2209@gmail.com"},
    {"id": 77, "puesto": "Orden y Limpieza", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 1, "email_asignado": "loren216454@gmail.com"},
    {"id": 78, "puesto": "Orden y Limpieza", "turno": "C", "dia": "2026-01-24", "hora_inicio": "16:00:00", "hora_fin": "20:00:00", "slot": 2, "email_asignado": None},
    {"id": 79, "puesto": "Orden y Limpieza", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 1, "email_asignado": None},
    {"id": 80, "puesto": "Orden y Limpieza", "turno": "D", "dia": "2026-01-24", "hora_inicio": "20:00:00", "hora_fin": "00:00:00", "slot": 2, "email_asignado": None},
    {"id": 81, "puesto": "Orden y Limpieza", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 1, "email_asignado": None},
    {"id": 82, "puesto": "Orden y Limpieza", "turno": "E", "dia": "2026-01-25", "hora_inicio": "00:00:00", "hora_fin": "04:00:00", "slot": 2, "email_asignado": None},
    {"id": 83, "puesto": "Orden y Limpieza", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 1, "email_asignado": None},
    {"id": 84, "puesto": "Orden y Limpieza", "turno": "F", "dia": "2026-01-25", "hora_inicio": "04:00:00", "hora_fin": "08:00:00", "slot": 2, "email_asignado": None},
    {"id": 85, "puesto": "Orden y Limpieza", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 1, "email_asignado": None},
    {"id": 86, "puesto": "Orden y Limpieza", "turno": "G", "dia": "2026-01-25", "hora_inicio": "08:00:00", "hora_fin": "12:00:00", "slot": 2, "email_asignado": None},
    {"id": 87, "puesto": "Registro y Check-in", "turno": "A", "dia": "2026-01-24", "hora_inicio": "06:00:00", "hora_fin": "08:30:00", "slot": 1, "email_asignado": "derlinmedrano09@gmail.com"},
    {"id": 88, "puesto": "Registro y Check-in", "turno": "A", "dia": "2026-01-24", "hora_inicio": "06:00:00", "hora_fin": "08:30:00", "slot": 2, "email_asignado": "auramorel29@gmail.com"},
    {"id": 89, "puesto": "Registro y Check-in", "turno": "A", "dia": "2026-01-24", "hora_inicio": "06:00:00", "hora_fin": "08:30:00", "slot": 3, "email_asignado": "mariaigl@icloud.com"},
    {"id": 90, "puesto": "Registro y Check-in", "turno": "A", "dia": "2026-01-24", "hora_inicio": "06:00:00", "hora_fin": "08:30:00", "slot": 4, "email_asignado": "uzielemilio21@gmail.com"},
]

VOLUNTEERS_DATA = [
    {"email": "veronica.ccuevas@gmail.com", "nombre": "Verónica Pamela", "apellidos": "Cabrera Cuevas", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18295694353"},
    {"email": "perlamassielbatista@gmail.com", "nombre": "Perla Massiel", "apellidos": "Peña Batista", "sexo": "Mujer", "lugar_residencia": "Moca", "telefono": "18297800752"},
    {"email": "elianacalderonmena@gmail.com", "nombre": "Eliana nathalie", "apellidos": "Calderon mena", "sexo": "Mujer", "lugar_residencia": "Moca", "telefono": "18097601193"},
    {"email": "brinydelmonter2@gmail.com", "nombre": "Bryny", "apellidos": "Delmonte", "sexo": "Mujer", "lugar_residencia": "Santiago", "telefono": "18494069957"},
    {"email": "dorisap79@gmail.com", "nombre": "Doris", "apellidos": "Alburquerque", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18295865607"},
    {"email": "danio286@gmail.com", "nombre": "Daniela", "apellidos": "Ortiz", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18492010087"},
    {"email": "jessejunior22@gmail.com", "nombre": "Jesse", "apellidos": "Pérez", "sexo": "Hombre", "lugar_residencia": "Santo Domingo Este", "telefono": "18096532699"},
    {"email": "liligutierrez310@gmail.com", "nombre": "Liliana", "apellidos": "Gutiérrez Camilo", "sexo": "Mujer", "lugar_residencia": "Bella vista", "telefono": "18293428788"},
    {"email": "gabrieldcm1000@gmail.com", "nombre": "Gabriel", "apellidos": "De Castro", "sexo": "Hombre", "lugar_residencia": "Santo Domingo, República Dominicana", "telefono": "18296372972"},
    {"email": "silifriedman@gmail.com", "nombre": "Sili", "apellidos": "Friedman", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18492529157"},
    {"email": "loren216454@gmail.com", "nombre": "Lorenza julia", "apellidos": "Martinez", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18296160976"},
    {"email": "laura.i.urena@gmail.com", "nombre": "Laura", "apellidos": "Ureña Bencosme", "sexo": "Mujer", "lugar_residencia": "DN - El Millón", "telefono": "18492579985"},
    {"email": "eduardogarciapallares7@gmail.com", "nombre": "Eduardo", "apellidos": "Garcia Pallares", "sexo": "Hombre", "lugar_residencia": "Santo Domingo", "telefono": "18096696921"},
    {"email": "anajuliasepulvedar@gmail.com", "nombre": "Ana Julia", "apellidos": "Sepulveda Ramirez", "sexo": "Mujer", "lugar_residencia": "Rosa Duarte #03 Gazcue", "telefono": "18296620657"},
    {"email": "rafaelsuazoh@gmail.com", "nombre": "Rafael", "apellidos": "Suazo Herrera", "sexo": "Hombre", "lugar_residencia": "Bella Vista", "telefono": "18496558431"},
    {"email": "minaya0507@gmail.com", "nombre": "Randy", "apellidos": "Minaya", "sexo": "Hombre", "lugar_residencia": "Santo Domingo", "telefono": "18295574450"},
    {"email": "sketchjose99@gmail.com", "nombre": "Jose", "apellidos": "Tejada", "sexo": "Hombre", "lugar_residencia": "Santo Domingo", "telefono": "18299888160"},
    {"email": "alexamperegrina@gmail.com", "nombre": "Alexa", "apellidos": "Martínez Peregrina", "sexo": "Mujer", "lugar_residencia": "Distrito Nacional, Santo Domingo", "telefono": "18493502980"},
    {"email": "contrerasgeorgina@gmail.com", "nombre": "Georgina", "apellidos": "Contreras", "sexo": "Mujer", "lugar_residencia": "Arroyo Hondo 3ro.", "telefono": "18297415439"},
    {"email": "chefesmeraldamartinez@gmail.com", "nombre": "Esmeralda", "apellidos": "Martínez", "sexo": "Mujer", "lugar_residencia": "Punta cana", "telefono": "18094094664"},
    {"email": "papoti@gmail.com", "nombre": "Apolinar", "apellidos": "Nunez", "sexo": "Hombre", "lugar_residencia": "Santiago", "telefono": "18097632172"},
    {"email": "100392598yp10@gmail.com", "nombre": "Yanibel", "apellidos": "Peña", "sexo": "Mujer", "lugar_residencia": "La Vega", "telefono": "18292506114"},
    {"email": "isammejia04@gmail.com", "nombre": "Isabella", "apellidos": "Mejía Rodríguez", "sexo": "Mujer", "lugar_residencia": "La Castellana. Distrito Nacional", "telefono": "18099820290"},
    {"email": "ronald.dbtc@gmail.com", "nombre": "Ronald", "apellidos": "Santos perez", "sexo": "Hombre", "lugar_residencia": "Santo domingo distrito", "telefono": "18499932515"},
    {"email": "menciacb2209@gmail.com", "nombre": "Mencia", "apellidos": "Cuevas", "sexo": "Mujer", "lugar_residencia": "Santo domingo", "telefono": "18097038179"},
    {"email": "anibalconga@gmail.com", "nombre": "José Anibal", "apellidos": "De León Valera", "sexo": "Hombre", "lugar_residencia": "Distrito Nacional", "telefono": None},
    {"email": "miguelangel104@hotmail.com", "nombre": "Miguel", "apellidos": "Rodríguez", "sexo": "Hombre", "lugar_residencia": "Santo Domingo Este", "telefono": "18292749620"},
    {"email": "laurajavier1816@gmail.com", "nombre": "Laura", "apellidos": "Javier", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18493575019"},
    {"email": "attysshm@gmail.com", "nombre": "Attys", "apellidos": "Saint-Hilaire", "sexo": "Mujer", "lugar_residencia": "España", "telefono": "18296847474"},
    {"email": "lisvetparramontas@gmail.com", "nombre": "Lisvet", "apellidos": "Parra Montas", "sexo": "Mujer", "lugar_residencia": "San Pedro de Macoris", "telefono": "18293997628"},
    {"email": "derlinmedrano09@gmail.com", "nombre": "Derlin", "apellidos": "Medrano Guzmán", "sexo": "Mujer", "lugar_residencia": "Santiago", "telefono": "18494043240"},
    {"email": "auramorel29@gmail.com", "nombre": "Aura", "apellidos": "Morel Peña", "sexo": "Mujer", "lugar_residencia": "Santiago", "telefono": "18097132004"},
    {"email": "miguelina.vasquez@gmail.com", "nombre": "Miguelina", "apellidos": "Vasquez", "sexo": "Mujer", "lugar_residencia": "Av. Carlos Perez Ricart", "telefono": "18098184829"},
    {"email": "ritarodriguezlara@gmail.com", "nombre": "Rita", "apellidos": "Rodriguez Lara", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18299164217"},
    {"email": "cindy.javierluna@gmail.com", "nombre": "Cindy", "apellidos": "Javier", "sexo": "Mujer", "lugar_residencia": "Distrito nacional", "telefono": None},
    {"email": "berlinguerrero21@gmail.com", "nombre": "Berlin Reynaldo", "apellidos": "Guerrero Guerrero", "sexo": "Hombre", "lugar_residencia": "Higüey", "telefono": None},
    {"email": "uzielemilio21@gmail.com", "nombre": "Uziel Emilio", "apellidos": "Rodriguez", "sexo": "Hombre", "lugar_residencia": "Santo Domingo, Distrito Nacional. Av, Independencia", "telefono": "18299301588"},
    {"email": "carolinazapata8@gmail.com", "nombre": "Carolina", "apellidos": "Zapata", "sexo": "Mujer", "lugar_residencia": "Santo Domingo Este", "telefono": "18294133370"},
    {"email": "sordehiperez@gmail.com", "nombre": "Sammir", "apellidos": "Ordehi Pérez", "sexo": "Hombre", "lugar_residencia": "Autop. Juan Pablo Duarte Km 11 Residencial Fermin Arturo", "telefono": "4020023947"},
    {"email": "daurisme@gmail.com", "nombre": "Daurisme", "apellidos": "Verdeja", "sexo": "Mujer", "lugar_residencia": "Santo domingo", "telefono": "18098831177"},
    {"email": "davidshdez18@gmail.com", "nombre": "David", "apellidos": "Sánchez Hernández", "sexo": "Hombre", "lugar_residencia": "Santo Domingo, RD", "telefono": "18099059634"},
    {"email": "denisse.acr@gmail.com", "nombre": "Denisse", "apellidos": "Casado", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18092162876"},
    {"email": "cfmateus07@gmail.com", "nombre": "Mateus", "apellidos": "Soares Caldeira", "sexo": "Hombre", "lugar_residencia": "Santo Domingo", "telefono": "18494522224"},
    {"email": "johangalvan18@gmail.com", "nombre": "Johan", "apellidos": "Galvan De Los Santos", "sexo": "Hombre", "lugar_residencia": "Distrito Nacional", "telefono": "18494992804"},
    {"email": "annaoc1107@gmail.com", "nombre": "Ana", "apellidos": "Ortiz", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18492010181"},
    {"email": "fabiangel12@gmail.com", "nombre": "Fabiola", "apellidos": "Castillo", "sexo": "Mujer", "lugar_residencia": "Los Alamos", "telefono": "18499129927"},
    {"email": "dattotilia57@gmail.com", "nombre": "Otilia", "apellidos": "Datt", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "18292593951"},
    {"email": "ltiradocordova@gmail.com", "nombre": "Luis", "apellidos": "Tirado Córdova", "sexo": "Hombre", "lugar_residencia": "Santo Domingo", "telefono": "18099249784"},
    {"email": "mariaigl@icloud.com", "nombre": "María Isabel", "apellidos": "Gutierrez", "sexo": "Mujer", "lugar_residencia": "Santo Domingo", "telefono": "8295998437"},
    {"email": "gleyflers7@gmail.com", "nombre": "Gleyfler", "apellidos": "Salvador", "sexo": "Hombre", "lugar_residencia": "Punta Cana", "telefono": "8299836510"},
    {"email": "minaya9507@gmail.com", "nombre": "Randy", "apellidos": "Minaya", "sexo": "Hombre", "lugar_residencia": "Santo Domingo", "telefono": "8295574450"},
    {"email": "esterlinleonardo17@gmail.com", "nombre": "Esterlin", "apellidos": "Leonardo De Los Santos", "sexo": "Hombre", "lugar_residencia": "Sol de luz, villa mella", "telefono": "8098201939"},
    {"email": "anaramirez29853@gmail.com", "nombre": "Ana Teresa", "apellidos": "Martinez Ramírez", "sexo": "Mujer", "lugar_residencia": "Santo Domingo norte", "telefono": "8092723204"},
    {"email": "geizel26@gmail.com", "nombre": "Geizel", "apellidos": "Voluntario", "sexo": None, "lugar_residencia": None, "telefono": None},
]

# ============================================================================
# Models
# ============================================================================

class VolunteerBase(BaseModel):
    email: str
    nombre: str
    apellidos: str
    sexo: Optional[str] = None
    lugar_residencia: Optional[str] = None
    telefono: Optional[str] = None

class AssignmentSlot(BaseModel):
    id: int
    puesto: str
    turno: str
    dia: str
    hora_inicio: str
    hora_fin: str
    slot: int
    email_asignado: Optional[str] = None
    nombre_asignado: Optional[str] = None

class AssignmentRequest(BaseModel):
    email: str

class AssignmentResponse(BaseModel):
    message: str
    success: bool


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/slots")
async def get_assignment_slots():
    """Get all assignment slots with assigned volunteer names"""
    from server import db as database
    
    slots = await database.volunteer_assignments.find({}, {"_id": 0}).to_list(1000)
    
    for slot in slots:
        if slot.get("email_asignado"):
            volunteer = await database.volunteers.find_one(
                {"email": slot["email_asignado"]},
                {"_id": 0, "nombre": 1, "apellidos": 1}
            )
            if volunteer:
                slot["nombre_asignado"] = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
            else:
                slot["nombre_asignado"] = slot["email_asignado"]
        else:
            slot["nombre_asignado"] = None
    
    return slots


@router.get("/positions")
async def get_positions():
    """Get list of unique positions"""
    from server import db as database
    
    positions = await database.volunteer_assignments.distinct("puesto")
    return sorted(positions)


@router.get("/shifts")
async def get_shifts():
    """Get list of unique shifts"""
    from server import db as database
    
    shifts = await database.volunteer_assignments.distinct("turno")
    return sorted(shifts)


@router.post("/assign/{slot_id}")
async def assign_volunteer(slot_id: int, request: AssignmentRequest):
    """Assign a volunteer to a slot"""
    from server import db as database
    
    email = request.email.strip().lower()
    
    # Verify volunteer exists (check both collections)
    volunteer = await database.volunteers.find_one({"email": email})
    if not volunteer:
        volunteer = await database.volunteer_registrations.find_one({"email": email})
    
    if not volunteer:
        return JSONResponse(
            status_code=400,
            content={"detail": "El correo electrónico no corresponde a un voluntario registrado. No es posible realizar la asignación."},
            headers={"X-Error-Detail": "El correo electrónico no corresponde a un voluntario registrado. No es posible realizar la asignación."}
        )
    
    # Check slot exists and is available
    slot = await database.volunteer_assignments.find_one({"id": slot_id})
    if not slot:
        return JSONResponse(
            status_code=404,
            content={"detail": "Slot no encontrado"},
            headers={"X-Error-Detail": "Slot no encontrado"}
        )
    
    if slot.get("email_asignado"):
        return JSONResponse(
            status_code=400,
            content={"detail": "Este espacio ya está asignado a otro voluntario"},
            headers={"X-Error-Detail": "Este espacio ya está asignado a otro voluntario"}
        )
    
    volunteer_name = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
    
    # Assign volunteer
    await database.volunteer_assignments.update_one(
        {"id": slot_id},
        {"$set": {
            "email_asignado": email, 
            "nombre_asignado": volunteer_name,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update volunteer registration status to confirmed and remove from slots_interes
    await database.volunteer_registrations.update_one(
        {"email": email},
        {
            "$set": {
                "status": "confirmed",
                "updated_at": datetime.utcnow()
            },
            "$pull": {"slots_interes": slot_id}
        }
    )
    
    # Schedule reminder for this new assignment
    try:
        from services.volunteer_scheduler import schedule_single_reminder
        schedule_single_reminder(
            slot_id=slot_id,
            dia=slot.get("dia", ""),
            hora_inicio=slot.get("hora_inicio", "")
        )
    except Exception as e:
        # Don't fail the assignment if scheduler fails
        print(f"Warning: Could not schedule reminder for slot {slot_id}: {e}")
    
    # Send confirmation email
    try:
        from services.email_service import send_email
        import os
        
        # Format time
        hora_inicio = slot.get("hora_inicio", "")
        hora_fin = slot.get("hora_fin", "")
        
        def format_time_12h(time_str):
            if not time_str or ':' not in time_str:
                return time_str
            parts = time_str.split(':')
            hour = int(parts[0])
            minutes = parts[1]
            ampm = 'PM' if hour >= 12 else 'AM'
            hour = hour % 12
            if hour == 0:
                hour = 12
            return f"{hour}:{minutes} {ampm}"
        
        hora_inicio_fmt = format_time_12h(hora_inicio)
        hora_fin_fmt = format_time_12h(hora_fin)
        puesto = slot.get("puesto", "")
        turno = slot.get("turno", "")
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #7c3aed;">🏃 Backyard Ultra Santo Domingo</h1>
            </div>
            
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <h2 style="margin: 0 0 10px 0;">✅ ¡Tu Turno ha sido Confirmado!</h2>
                <p style="margin: 0; opacity: 0.9;">Tu asignación como voluntario ha sido aprobada</p>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #64748b; margin-top: 0;">Hola <strong>{volunteer_name}</strong>,</p>
                <p style="color: #64748b;">
                    Nos complace informarte que tu solicitud de voluntariado ha sido confirmada. 
                    A continuación los detalles de tu asignación:
                </p>
            </div>
            
            <div style="background: #f0fdf4; border: 2px solid #22c55e; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="color: #166534; margin-top: 0;">📋 Detalles de tu Asignación</h3>
                <table style="width: 100%; color: #166534;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Posición:</td>
                        <td style="padding: 8px 0;">{puesto}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Turno:</td>
                        <td style="padding: 8px 0;">{turno}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Horario:</td>
                        <td style="padding: 8px 0;">{hora_inicio_fmt} - {hora_fin_fmt}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                    <strong>📌 Recuerda:</strong> Preséntate puntualmente en el punto de encuentro. 
                    Recibirás más información conforme se acerque la fecha del evento.
                </p>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
                ¡Gracias por ser parte del equipo de voluntarios! 💪<br>
                Tu apoyo es fundamental para el éxito del evento.
            </p>
        </div>
        """
        
        await send_email(
            to_email=email,
            subject="✅ ¡Tu Turno de Voluntario ha sido Confirmado! - BYSD",
            html_content=html_content
        )
        print(f"Assignment confirmation email sent to {email}")
    except Exception as e:
        print(f"Warning: Could not send confirmation email to {email}: {e}")
    
    return {
        "message": f"¡Asignación exitosa! {volunteer_name} ha sido asignado/a al turno.",
        "success": True,
        "volunteer_name": volunteer_name
    }


@router.post("/unassign/{slot_id}")
async def unassign_volunteer(slot_id: int, request: AssignmentRequest):
    """Remove a volunteer assignment from a slot"""
    from server import db as database
    
    email = request.email.strip().lower()
    
    # Check slot exists
    slot = await database.volunteer_assignments.find_one({"id": slot_id})
    if not slot:
        return JSONResponse(
            status_code=404,
            content={"detail": "Slot no encontrado"},
            headers={"X-Error-Detail": "Slot no encontrado"}
        )
    
    if not slot.get("email_asignado"):
        return JSONResponse(
            status_code=400,
            content={"detail": "Este espacio no tiene asignación"},
            headers={"X-Error-Detail": "Este espacio no tiene asignación"}
        )
    
    # Verify the email matches the assigned volunteer
    if slot["email_asignado"].lower() != email:
        return JSONResponse(
            status_code=400,
            content={"detail": "El correo electrónico no corresponde al voluntario asignado. No es posible eliminar la asignación."},
            headers={"X-Error-Detail": "El correo electrónico no corresponde al voluntario asignado. No es posible eliminar la asignación."}
        )
    
    # Remove assignment
    await database.volunteer_assignments.update_one(
        {"id": slot_id},
        {"$set": {
            "email_asignado": None, 
            "nombre_asignado": None,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Check if volunteer has other assignments - if not, revert status to "registered"
    other_assignments = await database.volunteer_assignments.count_documents({
        "email_asignado": email
    })
    
    if other_assignments == 0:
        # No more assignments, revert to registered status
        await database.volunteer_registrations.update_one(
            {"email": email},
            {"$set": {
                "status": "registered",
                "updated_at": datetime.utcnow()
            }}
        )
    
    # Cancel the reminder for this slot
    try:
        from services.volunteer_scheduler import cancel_single_reminder
        cancel_single_reminder(slot_id)
    except Exception as e:
        # Don't fail the unassignment if scheduler fails
        print(f"Warning: Could not cancel reminder for slot {slot_id}: {e}")
    
    return {
        "message": "Asignación eliminada exitosamente",
        "success": True
    }


@router.get("/list")
async def get_volunteers():
    """Get all registered volunteers"""
    from server import db as database
    
    volunteers = await database.volunteers.find(
        {}, 
        {"_id": 0, "email": 1, "nombre": 1, "apellidos": 1}
    ).to_list(1000)
    
    return volunteers


@router.post("/init-data")
async def init_volunteer_data():
    """Initialize volunteer and assignment data from hardcoded data"""
    from server import db as database
    
    try:
        # Clear existing data
        await database.volunteer_assignments.drop()
        await database.volunteers.drop()
        
        # Process assignments from hardcoded data
        assignments = []
        for item in ASSIGNMENTS_DATA:
            assignments.append({
                **item,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
        
        # Process volunteers from hardcoded data
        volunteers = []
        seen_emails = set()
        for item in VOLUNTEERS_DATA:
            email = item["email"].strip().lower()
            if email not in seen_emails:
                seen_emails.add(email)
                volunteers.append({
                    **item,
                    "created_at": datetime.utcnow()
                })
        
        # Insert data
        if assignments:
            await database.volunteer_assignments.insert_many(assignments)
        if volunteers:
            await database.volunteers.insert_many(volunteers)
        
        return {
            "message": "Datos inicializados exitosamente desde datos embebidos",
            "assignments_count": len(assignments),
            "volunteers_count": len(volunteers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EMAIL NOTIFICATION ENDPOINTS
# ============================================================================

class TestEmailRequest(BaseModel):
    email: str
    type: str  # "reminder" or "assignments"
    slot_id: Optional[int] = None  # Required for reminder type


@router.post("/send-test-reminder")
async def send_test_reminder_email(request: TestEmailRequest):
    """Send a test reminder email (1 hour before shift)"""
    from server import db as database
    from services.volunteer_email_service import send_volunteer_reminder_email
    
    email = request.email.strip().lower()
    
    # Get a sample assignment for testing
    if request.slot_id:
        assignment = await database.volunteer_assignments.find_one(
            {"id": request.slot_id, "email_asignado": {"$ne": None}},
            {"_id": 0}
        )
    else:
        # Get first assigned slot
        assignment = await database.volunteer_assignments.find_one(
            {"email_asignado": {"$ne": None}},
            {"_id": 0}
        )
    
    if not assignment:
        raise HTTPException(status_code=404, detail="No hay asignaciones disponibles para probar")
    
    # Use test volunteer name
    volunteer_name = "Voluntario de Prueba"
    
    success = await send_volunteer_reminder_email(
        to_email=email,
        volunteer_name=volunteer_name,
        assignment=assignment
    )
    
    if success:
        return {
            "message": f"Email de recordatorio enviado exitosamente a {email}",
            "success": True,
            "assignment_tested": {
                "puesto": assignment.get("puesto"),
                "turno": assignment.get("turno"),
                "hora_inicio": assignment.get("hora_inicio")
            }
        }
    else:
        raise HTTPException(status_code=500, detail="Error al enviar el email")


@router.post("/send-test-assignments")
async def send_test_assignments_email(request: TestEmailRequest):
    """Send a test assignments summary email (Friday 6pm email)"""
    from server import db as database
    from services.volunteer_email_service import send_volunteer_assignments_email
    
    email = request.email.strip().lower()
    
    # Get sample assignments for testing (get multiple to show the multi-turno feature)
    assignments = await database.volunteer_assignments.find(
        {"email_asignado": {"$ne": None}},
        {"_id": 0}
    ).limit(4).to_list(4)
    
    if not assignments:
        raise HTTPException(status_code=404, detail="No hay asignaciones disponibles para probar")
    
    # Use test volunteer name
    volunteer_name = "Voluntario de Prueba"
    
    success = await send_volunteer_assignments_email(
        to_email=email,
        volunteer_name=volunteer_name,
        assignments=assignments
    )
    
    if success:
        return {
            "message": f"Email de asignaciones enviado exitosamente a {email}",
            "success": True,
            "total_assignments_shown": len(assignments)
        }
    else:
        raise HTTPException(status_code=500, detail="Error al enviar el email")


@router.post("/send-reminder/{slot_id}")
async def send_slot_reminder(slot_id: int):
    """Send reminder email to the volunteer assigned to a specific slot"""
    from server import db as database
    from services.volunteer_email_service import send_volunteer_reminder_email
    
    # Get the assignment
    assignment = await database.volunteer_assignments.find_one(
        {"id": slot_id},
        {"_id": 0}
    )
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Slot no encontrado")
    
    if not assignment.get("email_asignado"):
        raise HTTPException(status_code=400, detail="Este slot no tiene voluntario asignado")
    
    # Get volunteer info
    volunteer = await database.volunteers.find_one(
        {"email": assignment["email_asignado"]},
        {"_id": 0}
    )
    
    if not volunteer:
        raise HTTPException(status_code=404, detail="Voluntario no encontrado")
    
    volunteer_name = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
    
    success = await send_volunteer_reminder_email(
        to_email=assignment["email_asignado"],
        volunteer_name=volunteer_name,
        assignment=assignment
    )
    
    if success:
        return {
            "message": f"Recordatorio enviado a {volunteer_name}",
            "success": True,
            "email": assignment["email_asignado"]
        }
    else:
        raise HTTPException(status_code=500, detail="Error al enviar el email")


@router.post("/send-all-assignments")
async def send_all_volunteers_assignments():
    """Send assignments summary email to ALL volunteers with assignments (Friday 6pm email)"""
    from server import db as database
    from services.volunteer_email_service import send_volunteer_assignments_email
    
    # Get all unique emails with assignments
    pipeline = [
        {"$match": {"email_asignado": {"$ne": None}}},
        {"$group": {"_id": "$email_asignado"}}
    ]
    
    unique_emails = await database.volunteer_assignments.aggregate(pipeline).to_list(1000)
    
    results = {
        "total_volunteers": len(unique_emails),
        "emails_sent": 0,
        "emails_failed": 0,
        "details": []
    }
    
    for item in unique_emails:
        email = item["_id"]
        
        # Get volunteer info
        volunteer = await database.volunteers.find_one(
            {"email": email},
            {"_id": 0}
        )
        
        if not volunteer:
            results["emails_failed"] += 1
            results["details"].append({"email": email, "status": "volunteer_not_found"})
            continue
        
        # Get all assignments for this volunteer
        assignments = await database.volunteer_assignments.find(
            {"email_asignado": email},
            {"_id": 0}
        ).to_list(100)
        
        volunteer_name = f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip()
        
        success = await send_volunteer_assignments_email(
            to_email=email,
            volunteer_name=volunteer_name,
            assignments=assignments
        )
        
        if success:
            results["emails_sent"] += 1
            results["details"].append({
                "email": email,
                "name": volunteer_name,
                "assignments_count": len(assignments),
                "status": "sent"
            })
        else:
            results["emails_failed"] += 1
            results["details"].append({"email": email, "status": "send_failed"})
    
    return results


@router.get("/volunteers-with-assignments")
async def get_volunteers_with_assignments():
    """Get list of all volunteers who have at least one assignment"""
    from server import db as database
    
    # Get all unique emails with assignments
    pipeline = [
        {"$match": {"email_asignado": {"$ne": None}}},
        {"$group": {
            "_id": "$email_asignado",
            "total_turnos": {"$sum": 1},
            "turnos": {"$push": {
                "puesto": "$puesto",
                "turno": "$turno",
                "dia": "$dia",
                "hora_inicio": "$hora_inicio",
                "hora_fin": "$hora_fin"
            }}
        }},
        {"$sort": {"total_turnos": -1}}
    ]
    
    assignments_by_email = await database.volunteer_assignments.aggregate(pipeline).to_list(1000)
    
    result = []
    for item in assignments_by_email:
        email = item["_id"]
        volunteer = await database.volunteers.find_one(
            {"email": email},
            {"_id": 0, "nombre": 1, "apellidos": 1, "email": 1}
        )
        
        if volunteer:
            result.append({
                "email": email,
                "nombre": f"{volunteer.get('nombre', '')} {volunteer.get('apellidos', '')}".strip(),
                "total_turnos": item["total_turnos"],
                "turnos": item["turnos"]
            })
    
    return result


# ============================================================================
# SCHEDULER ENDPOINTS
# ============================================================================

@router.post("/scheduler/init")
async def initialize_scheduler():
    """Initialize the volunteer email scheduler"""
    from services.volunteer_scheduler import init_scheduler, schedule_friday_email, schedule_all_reminders
    
    init_scheduler()
    schedule_friday_email()
    result = await schedule_all_reminders()
    
    return {
        "message": "Scheduler initialized successfully",
        "friday_email_scheduled": True,
        "reminders": result
    }


@router.post("/scheduler/schedule-reminders")
async def schedule_reminders():
    """Schedule all 1-hour reminder emails"""
    from services.volunteer_scheduler import schedule_all_reminders
    
    result = await schedule_all_reminders()
    return result


@router.post("/scheduler/schedule-friday-email")
async def schedule_friday():
    """Schedule the Friday 6pm mass email"""
    from services.volunteer_scheduler import schedule_friday_email
    
    schedule_friday_email()
    return {"message": "Friday mass email scheduled for January 23, 2026 at 6:00 PM"}


@router.get("/scheduler/jobs")
async def get_scheduler_jobs():
    """Get list of all scheduled jobs"""
    from services.volunteer_scheduler import get_scheduled_jobs
    
    jobs = get_scheduled_jobs()
    return {
        "total_jobs": len(jobs),
        "jobs": jobs
    }


@router.post("/scheduler/trigger-friday-email-now")
async def trigger_friday_email_now():
    """Manually trigger the Friday mass email (for testing)"""
    from services.volunteer_scheduler import send_friday_mass_email
    
    await send_friday_mass_email()
    return {"message": "Friday mass email triggered"}

