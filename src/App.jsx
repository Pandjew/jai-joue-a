import React, { useState, useEffect } from "react";
import {
  ChevronRight, RotateCcw, Home, HelpCircle,
  Check, X, Crown, Globe, Star, Award,
} from "lucide-react";
import generated from "./players.json";
import { db } from "./firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

/**
 * "J'AI JOUÉ À" — jeu de devinette de footballeurs
 * ------------------------------------------------------------
 * BASE DE DONNÉES (PLAYERS) :
 *  - name    : nom révélé (jamais affiché avant la réponse)
 *  - alt     : surnoms / formes acceptées en réponse
 *  - leagues : top-5 fréquentés -> 'l1','pl','sa','bl','lg'
 *  - legend  : true => mode "XI de légende"
 *  - career  : { club, years, apps, goals }   (apps/goals APPROXIMATIFS)
 * Ajouter un joueur = copier un bloc et compléter.
 *
 * ÉCUSSONS : monogrammes colorés (CLUB_STYLE) -> sûrs niveau droits.
 * Pour de vrais logos plus tard : ajouter un champ `logo` (URL) et
 * brancher une API foot (ex. football-data.org) — cf. note de livraison.
 * ------------------------------------------------------------
 */

const CURATED = [
  // ---- Légendes / icônes ----
  { name: "Lionel Messi", alt: ["messi", "leo", "leo messi"], leagues: ["lg", "l1"], legend: true, career: [
    { club: "FC Barcelone", years: "2004–2021", apps: 520, goals: 474 },
    { club: "Paris Saint-Germain", years: "2021–2023", apps: 58, goals: 22 },
    { club: "Inter Miami", years: "2023–", apps: 45, goals: 40 }]},
  { name: "Cristiano Ronaldo", alt: ["ronaldo", "cristiano", "cr7"], leagues: ["pl", "lg", "sa"], legend: true, career: [
    { club: "Sporting CP", years: "2002–2003", apps: 25, goals: 3 },
    { club: "Manchester United", years: "2003–2009", apps: 196, goals: 84 },
    { club: "Real Madrid", years: "2009–2018", apps: 292, goals: 311 },
    { club: "Juventus", years: "2018–2021", apps: 98, goals: 81 },
    { club: "Manchester United", years: "2021–2022", apps: 40, goals: 19 },
    { club: "Al-Nassr", years: "2023–", apps: 75, goals: 70 }]},
  { name: "Zinedine Zidane", alt: ["zidane", "zizou"], leagues: ["l1", "sa", "lg"], legend: true, career: [
    { club: "AS Cannes", years: "1989–1992", apps: 61, goals: 6 },
    { club: "Girondins de Bordeaux", years: "1992–1996", apps: 139, goals: 28 },
    { club: "Juventus", years: "1996–2001", apps: 151, goals: 24 },
    { club: "Real Madrid", years: "2001–2006", apps: 155, goals: 37 }]},
  { name: "Ronaldinho", alt: ["ronaldinho", "dinho"], leagues: ["l1", "lg", "sa"], legend: true, career: [
    { club: "Grêmio", years: "1998–2001", apps: 52, goals: 21 },
    { club: "Paris Saint-Germain", years: "2001–2003", apps: 55, goals: 17 },
    { club: "FC Barcelone", years: "2003–2008", apps: 145, goals: 70 },
    { club: "AC Milan", years: "2008–2011", apps: 76, goals: 20 },
    { club: "Flamengo", years: "2011–2012", apps: 33, goals: 15 }]},
  { name: "Thierry Henry", alt: ["henry", "titi"], leagues: ["l1", "sa", "pl", "lg"], legend: true, career: [
    { club: "AS Monaco", years: "1994–1999", apps: 105, goals: 20 },
    { club: "Juventus", years: "1999", apps: 16, goals: 3 },
    { club: "Arsenal", years: "1999–2007", apps: 254, goals: 174 },
    { club: "FC Barcelone", years: "2007–2010", apps: 80, goals: 35 },
    { club: "New York Red Bulls", years: "2010–2014", apps: 122, goals: 51 }]},
  { name: "Ronaldo Nazário", alt: ["ronaldo", "ronaldo nazario", "il fenomeno", "r9"], leagues: ["lg", "sa"], legend: true, career: [
    { club: "Cruzeiro", years: "1993–1994", apps: 47, goals: 44 },
    { club: "PSV Eindhoven", years: "1994–1996", apps: 57, goals: 54 },
    { club: "FC Barcelone", years: "1996–1997", apps: 49, goals: 47 },
    { club: "Inter Milan", years: "1997–2002", apps: 99, goals: 59 },
    { club: "Real Madrid", years: "2002–2007", apps: 177, goals: 104 },
    { club: "AC Milan", years: "2007–2008", apps: 20, goals: 9 },
    { club: "Corinthians", years: "2009–2011", apps: 52, goals: 29 }]},
  { name: "Zlatan Ibrahimović", alt: ["ibrahimovic", "zlatan", "ibra"], leagues: ["sa", "lg", "l1", "pl"], legend: true, career: [
    { club: "Ajax", years: "2001–2004", apps: 74, goals: 35 },
    { club: "Juventus", years: "2004–2006", apps: 70, goals: 23 },
    { club: "Inter Milan", years: "2006–2009", apps: 88, goals: 57 },
    { club: "FC Barcelone", years: "2009–2011", apps: 46, goals: 22 },
    { club: "AC Milan", years: "2010–2012", apps: 61, goals: 42 },
    { club: "Paris Saint-Germain", years: "2012–2016", apps: 122, goals: 113 },
    { club: "Manchester United", years: "2016–2018", apps: 33, goals: 17 },
    { club: "LA Galaxy", years: "2018–2019", apps: 56, goals: 53 },
    { club: "AC Milan", years: "2020–2023", apps: 51, goals: 22 }]},
  { name: "Andrea Pirlo", alt: ["pirlo"], leagues: ["sa"], legend: true, career: [
    { club: "Brescia", years: "1995–2001", apps: 47, goals: 6 },
    { club: "Inter Milan", years: "1998–2001", apps: 22, goals: 0 },
    { club: "AC Milan", years: "2001–2011", apps: 284, goals: 32 },
    { club: "Juventus", years: "2011–2015", apps: 119, goals: 16 },
    { club: "New York City FC", years: "2015–2017", apps: 61, goals: 1 }]},
  { name: "Paolo Maldini", alt: ["maldini"], leagues: ["sa"], legend: true, career: [
    { club: "AC Milan", years: "1985–2009", apps: 647, goals: 29 }]},
  { name: "Francesco Totti", alt: ["totti"], leagues: ["sa"], legend: true, career: [
    { club: "AS Roma", years: "1992–2017", apps: 619, goals: 250 }]},
  { name: "Kaká", alt: ["kaka"], leagues: ["sa", "lg"], legend: true, career: [
    { club: "São Paulo", years: "2001–2003", apps: 58, goals: 23 },
    { club: "AC Milan", years: "2003–2009", apps: 193, goals: 70 },
    { club: "Real Madrid", years: "2009–2013", apps: 85, goals: 23 },
    { club: "AC Milan", years: "2013–2014", apps: 30, goals: 7 },
    { club: "Orlando City", years: "2014–2017", apps: 75, goals: 24 }]},
  { name: "Steven Gerrard", alt: ["gerrard", "stevie g"], leagues: ["pl"], legend: true, career: [
    { club: "Liverpool", years: "1998–2015", apps: 504, goals: 120 },
    { club: "LA Galaxy", years: "2015–2016", apps: 34, goals: 5 }]},
  { name: "Frank Lampard", alt: ["lampard"], leagues: ["pl"], legend: true, career: [
    { club: "West Ham United", years: "1995–2001", apps: 148, goals: 24 },
    { club: "Chelsea", years: "2001–2014", apps: 429, goals: 147 },
    { club: "Manchester City", years: "2014–2015", apps: 32, goals: 6 },
    { club: "New York City FC", years: "2015–2016", apps: 31, goals: 15 }]},
  { name: "Xavi", alt: ["xavi", "xavi hernandez"], leagues: ["lg"], legend: true, career: [
    { club: "FC Barcelone", years: "1998–2015", apps: 505, goals: 58 },
    { club: "Al Sadd", years: "2015–2019", apps: 100, goals: 21 }]},
  { name: "Andrés Iniesta", alt: ["iniesta"], leagues: ["lg"], legend: true, career: [
    { club: "FC Barcelone", years: "2002–2018", apps: 442, goals: 35 },
    { club: "Vissel Kobe", years: "2018–2023", apps: 120, goals: 17 }]},
  { name: "Carles Puyol", alt: ["puyol"], leagues: ["lg"], legend: true, career: [
    { club: "FC Barcelone", years: "1999–2014", apps: 593, goals: 18 }]},
  { name: "Iker Casillas", alt: ["casillas", "san iker"], leagues: ["lg"], legend: true, career: [
    { club: "Real Madrid", years: "1999–2015", apps: 725, goals: 0 },
    { club: "FC Porto", years: "2015–2020", apps: 156, goals: 0 }]},
  { name: "Raúl", alt: ["raul", "raul gonzalez"], leagues: ["lg", "bl"], legend: true, career: [
    { club: "Real Madrid", years: "1994–2010", apps: 550, goals: 228 },
    { club: "Schalke 04", years: "2010–2012", apps: 66, goals: 28 },
    { club: "Al Sadd", years: "2012–2014", apps: 41, goals: 18 }]},
  { name: "Samuel Eto'o", alt: ["etoo", "eto o", "samuel etoo"], leagues: ["lg", "sa", "pl"], legend: true, career: [
    { club: "RCD Majorque", years: "2000–2004", apps: 133, goals: 54 },
    { club: "FC Barcelone", years: "2004–2009", apps: 144, goals: 108 },
    { club: "Inter Milan", years: "2009–2011", apps: 67, goals: 33 },
    { club: "Chelsea", years: "2013–2014", apps: 21, goals: 9 },
    { club: "Everton", years: "2014–2015", apps: 24, goals: 4 }]},
  { name: "David Beckham", alt: ["beckham", "becks"], leagues: ["pl", "lg", "sa", "l1"], legend: true, career: [
    { club: "Manchester United", years: "1992–2003", apps: 394, goals: 85 },
    { club: "Real Madrid", years: "2003–2007", apps: 159, goals: 20 },
    { club: "LA Galaxy", years: "2007–2012", apps: 118, goals: 20 },
    { club: "AC Milan", years: "2009–2010", apps: 33, goals: 2 },
    { club: "Paris Saint-Germain", years: "2013", apps: 14, goals: 0 }]},
  { name: "Wayne Rooney", alt: ["rooney", "wazza"], leagues: ["pl"], legend: true, career: [
    { club: "Everton", years: "2002–2004", apps: 77, goals: 17 },
    { club: "Manchester United", years: "2004–2017", apps: 559, goals: 253 },
    { club: "Everton", years: "2017–2018", apps: 40, goals: 11 },
    { club: "DC United", years: "2018–2020", apps: 52, goals: 25 }]},
  { name: "Didier Drogba", alt: ["drogba"], leagues: ["l1", "pl"], legend: true, career: [
    { club: "EA Guingamp", years: "2002–2003", apps: 45, goals: 20 },
    { club: "Olympique de Marseille", years: "2003–2004", apps: 55, goals: 32 },
    { club: "Chelsea", years: "2004–2012", apps: 381, goals: 157 },
    { club: "Galatasaray", years: "2013–2014", apps: 37, goals: 15 },
    { club: "Chelsea", years: "2014–2015", apps: 40, goals: 7 }]},
  { name: "Sergio Agüero", alt: ["aguero", "kun", "kun aguero"], leagues: ["lg", "pl"], legend: true, career: [
    { club: "Independiente", years: "2003–2006", apps: 56, goals: 23 },
    { club: "Atlético Madrid", years: "2006–2011", apps: 234, goals: 101 },
    { club: "Manchester City", years: "2011–2021", apps: 390, goals: 260 },
    { club: "FC Barcelone", years: "2021", apps: 5, goals: 1 }]},
  { name: "Diego Forlán", alt: ["forlan"], leagues: ["pl", "lg", "sa"], legend: true, career: [
    { club: "Manchester United", years: "2002–2004", apps: 98, goals: 17 },
    { club: "Villarreal", years: "2004–2007", apps: 128, goals: 54 },
    { club: "Atlético Madrid", years: "2007–2011", apps: 198, goals: 96 },
    { club: "Inter Milan", years: "2011–2012", apps: 25, goals: 2 }]},
  { name: "Fernando Torres", alt: ["torres", "el nino", "nino"], leagues: ["lg", "pl", "sa"], legend: true, career: [
    { club: "Atlético Madrid", years: "2001–2007", apps: 214, goals: 75 },
    { club: "Liverpool", years: "2007–2011", apps: 142, goals: 81 },
    { club: "Chelsea", years: "2011–2014", apps: 172, goals: 45 },
    { club: "AC Milan", years: "2014–2015", apps: 10, goals: 1 },
    { club: "Atlético Madrid", years: "2015–2018", apps: 110, goals: 38 }]},
  { name: "Patrick Vieira", alt: ["vieira"], leagues: ["l1", "sa", "pl"], legend: true, career: [
    { club: "AS Cannes", years: "1993–1995", apps: 49, goals: 2 },
    { club: "AC Milan", years: "1995–1996", apps: 2, goals: 0 },
    { club: "Arsenal", years: "1996–2005", apps: 279, goals: 29 },
    { club: "Juventus", years: "2005–2006", apps: 31, goals: 5 },
    { club: "Inter Milan", years: "2006–2010", apps: 64, goals: 6 },
    { club: "Manchester City", years: "2010–2011", apps: 30, goals: 3 }]},
  { name: "Claude Makélélé", alt: ["makelele"], leagues: ["l1", "lg", "pl"], legend: true, career: [
    { club: "FC Nantes", years: "1992–1997", apps: 134, goals: 6 },
    { club: "Celta Vigo", years: "1998–2000", apps: 70, goals: 8 },
    { club: "Real Madrid", years: "2000–2003", apps: 94, goals: 0 },
    { club: "Chelsea", years: "2003–2008", apps: 144, goals: 2 },
    { club: "Paris Saint-Germain", years: "2008–2011", apps: 84, goals: 2 }]},
  { name: "Ryan Giggs", alt: ["giggs"], leagues: ["pl"], legend: true, career: [
    { club: "Manchester United", years: "1990–2014", apps: 672, goals: 114 }]},
  { name: "Paul Scholes", alt: ["scholes"], leagues: ["pl"], legend: true, career: [
    { club: "Manchester United", years: "1993–2013", apps: 499, goals: 107 }]},
  { name: "Michael Owen", alt: ["owen"], leagues: ["pl", "lg"], legend: true, career: [
    { club: "Liverpool", years: "1996–2004", apps: 216, goals: 118 },
    { club: "Real Madrid", years: "2004–2005", apps: 36, goals: 13 },
    { club: "Newcastle United", years: "2005–2009", apps: 71, goals: 26 },
    { club: "Manchester United", years: "2009–2012", apps: 31, goals: 5 },
    { club: "Stoke City", years: "2012–2013", apps: 8, goals: 1 }]},

  // ---- Modernes / actifs ----
  { name: "Kylian Mbappé", alt: ["mbappe", "kiki"], leagues: ["l1", "lg"], career: [
    { club: "AS Monaco", years: "2015–2017", apps: 41, goals: 16 },
    { club: "Paris Saint-Germain", years: "2017–2024", apps: 308, goals: 256 },
    { club: "Real Madrid", years: "2024–", apps: 55, goals: 50 }]},
  { name: "Erling Haaland", alt: ["haaland"], leagues: ["bl", "pl"], career: [
    { club: "Molde", years: "2017–2019", apps: 50, goals: 20 },
    { club: "RB Salzbourg", years: "2019–2020", apps: 27, goals: 29 },
    { club: "Borussia Dortmund", years: "2020–2022", apps: 89, goals: 86 },
    { club: "Manchester City", years: "2022–", apps: 120, goals: 120 }]},
  { name: "Kevin De Bruyne", alt: ["de bruyne", "kdb"], leagues: ["pl", "bl"], career: [
    { club: "KRC Genk", years: "2008–2012", apps: 97, goals: 17 },
    { club: "Chelsea", years: "2012–2014", apps: 9, goals: 0 },
    { club: "Werder Brême", years: "2012–2013", apps: 33, goals: 10 },
    { club: "VfL Wolfsbourg", years: "2014–2015", apps: 72, goals: 20 },
    { club: "Manchester City", years: "2015–2025", apps: 413, goals: 108 }]},
  { name: "Robert Lewandowski", alt: ["lewandowski", "lewy"], leagues: ["bl", "lg"], career: [
    { club: "Lech Poznań", years: "2008–2010", apps: 58, goals: 32 },
    { club: "Borussia Dortmund", years: "2010–2014", apps: 131, goals: 74 },
    { club: "Bayern Munich", years: "2014–2022", apps: 253, goals: 238 },
    { club: "FC Barcelone", years: "2022–", apps: 110, goals: 75 }]},
  { name: "Luka Modrić", alt: ["modric"], leagues: ["pl", "lg"], career: [
    { club: "Dinamo Zagreb", years: "2005–2008", apps: 96, goals: 26 },
    { club: "Tottenham Hotspur", years: "2008–2012", apps: 127, goals: 13 },
    { club: "Real Madrid", years: "2012–2025", apps: 460, goals: 40 }]},
  { name: "Harry Kane", alt: ["kane"], leagues: ["pl", "bl"], career: [
    { club: "Tottenham Hotspur", years: "2011–2023", apps: 320, goals: 280 },
    { club: "Bayern Munich", years: "2023–", apps: 90, goals: 95 }]},
  { name: "Mohamed Salah", alt: ["salah", "mo salah"], leagues: ["pl", "sa"], career: [
    { club: "FC Bâle", years: "2012–2014", apps: 79, goals: 20 },
    { club: "Chelsea", years: "2014–2016", apps: 13, goals: 2 },
    { club: "Fiorentina", years: "2015", apps: 16, goals: 6 },
    { club: "AS Roma", years: "2015–2017", apps: 65, goals: 29 },
    { club: "Liverpool", years: "2017–", apps: 370, goals: 240 }]},
  { name: "Karim Benzema", alt: ["benzema", "kb9"], leagues: ["l1", "lg"], career: [
    { club: "Olympique Lyonnais", years: "2004–2009", apps: 112, goals: 43 },
    { club: "Real Madrid", years: "2009–2023", apps: 439, goals: 238 },
    { club: "Al-Ittihad", years: "2023–", apps: 60, goals: 35 }]},
  { name: "Jude Bellingham", alt: ["bellingham", "jude"], leagues: ["bl", "lg"], career: [
    { club: "Birmingham City", years: "2019–2020", apps: 44, goals: 4 },
    { club: "Borussia Dortmund", years: "2020–2023", apps: 92, goals: 24 },
    { club: "Real Madrid", years: "2023–", apps: 90, goals: 40 }]},
  { name: "Antoine Griezmann", alt: ["griezmann", "grizou"], leagues: ["lg"], career: [
    { club: "Real Sociedad", years: "2009–2014", apps: 180, goals: 52 },
    { club: "Atlético Madrid", years: "2014–2019", apps: 257, goals: 133 },
    { club: "FC Barcelone", years: "2019–2021", apps: 102, goals: 35 },
    { club: "Atlético Madrid", years: "2021–", apps: 190, goals: 85 }]},
  { name: "N'Golo Kanté", alt: ["kante"], leagues: ["l1", "pl"], career: [
    { club: "SM Caen", years: "2013–2015", apps: 75, goals: 3 },
    { club: "Leicester City", years: "2015–2016", apps: 37, goals: 1 },
    { club: "Chelsea", years: "2016–2023", apps: 264, goals: 13 },
    { club: "Al-Ittihad", years: "2023–", apps: 50, goals: 5 }]},
  { name: "Sergio Ramos", alt: ["ramos"], leagues: ["lg", "l1"], career: [
    { club: "Séville FC", years: "2004–2005", apps: 41, goals: 2 },
    { club: "Real Madrid", years: "2005–2021", apps: 671, goals: 101 },
    { club: "Paris Saint-Germain", years: "2021–2023", apps: 58, goals: 6 },
    { club: "Séville FC", years: "2023–2024", apps: 28, goals: 3 }]},
  { name: "Gianluigi Buffon", alt: ["buffon", "gigi buffon"], leagues: ["sa", "l1"], legend: true, career: [
    { club: "Parme", years: "1995–2001", apps: 220, goals: 0 },
    { club: "Juventus", years: "2001–2018", apps: 656, goals: 0 },
    { club: "Paris Saint-Germain", years: "2018–2019", apps: 25, goals: 0 },
    { club: "Juventus", years: "2019–2021", apps: 30, goals: 0 },
    { club: "Parme", years: "2021–2023", apps: 60, goals: 0 }]},
  { name: "Luis Suárez", alt: ["suarez", "el pistolero"], leagues: ["pl", "lg"], career: [
    { club: "Ajax", years: "2007–2011", apps: 110, goals: 81 },
    { club: "Liverpool", years: "2011–2014", apps: 110, goals: 69 },
    { club: "FC Barcelone", years: "2014–2020", apps: 191, goals: 147 },
    { club: "Atlético Madrid", years: "2020–2022", apps: 67, goals: 32 },
    { club: "Inter Miami", years: "2024–", apps: 40, goals: 25 }]},
  { name: "Neymar", alt: ["neymar", "ney", "neymar jr"], leagues: ["lg", "l1"], career: [
    { club: "Santos", years: "2009–2013", apps: 225, goals: 136 },
    { club: "FC Barcelone", years: "2013–2017", apps: 123, goals: 68 },
    { club: "Paris Saint-Germain", years: "2017–2023", apps: 173, goals: 118 },
    { club: "Al-Hilal", years: "2023–2025", apps: 7, goals: 1 }]},
  { name: "Toni Kroos", alt: ["kroos"], leagues: ["bl", "lg"], career: [
    { club: "Bayern Munich", years: "2007–2014", apps: 205, goals: 24 },
    { club: "Bayer Leverkusen", years: "2009–2010", apps: 43, goals: 10 },
    { club: "Real Madrid", years: "2014–2024", apps: 465, goals: 28 }]},
  { name: "Thomas Müller", alt: ["muller", "mullaa"], leagues: ["bl"], career: [
    { club: "Bayern Munich", years: "2008–2025", apps: 720, goals: 250 }]},
  { name: "Manuel Neuer", alt: ["neuer"], leagues: ["bl"], career: [
    { club: "Schalke 04", years: "2006–2011", apps: 203, goals: 0 },
    { club: "Bayern Munich", years: "2011–", apps: 500, goals: 0 }]},
  { name: "Virgil van Dijk", alt: ["van dijk", "vvd"], leagues: ["pl"], career: [
    { club: "FC Groningue", years: "2011–2013", apps: 62, goals: 7 },
    { club: "Celtic", years: "2013–2015", apps: 76, goals: 9 },
    { club: "Southampton", years: "2015–2018", apps: 76, goals: 4 },
    { club: "Liverpool", years: "2018–", apps: 310, goals: 27 }]},
  { name: "Paul Pogba", alt: ["pogba", "pogboom"], leagues: ["pl", "sa"], career: [
    { club: "Manchester United", years: "2011–2012", apps: 7, goals: 0 },
    { club: "Juventus", years: "2012–2016", apps: 178, goals: 34 },
    { club: "Manchester United", years: "2016–2022", apps: 233, goals: 39 },
    { club: "Juventus", years: "2022–2024", apps: 12, goals: 0 }]},
  { name: "Eden Hazard", alt: ["hazard"], leagues: ["l1", "pl", "lg"], career: [
    { club: "Lille OSC", years: "2007–2012", apps: 194, goals: 50 },
    { club: "Chelsea", years: "2012–2019", apps: 352, goals: 110 },
    { club: "Real Madrid", years: "2019–2023", apps: 76, goals: 7 }]},
  { name: "Gareth Bale", alt: ["bale"], leagues: ["pl", "lg"], career: [
    { club: "Southampton", years: "2006–2007", apps: 40, goals: 5 },
    { club: "Tottenham Hotspur", years: "2007–2013", apps: 203, goals: 55 },
    { club: "Real Madrid", years: "2013–2022", apps: 258, goals: 106 },
    { club: "Los Angeles FC", years: "2022–2023", apps: 14, goals: 3 }]},
  { name: "Ángel Di María", alt: ["di maria", "fideo"], leagues: ["lg", "pl", "l1", "sa"], career: [
    { club: "Benfica", years: "2007–2010", apps: 76, goals: 13 },
    { club: "Real Madrid", years: "2010–2014", apps: 124, goals: 22 },
    { club: "Manchester United", years: "2014–2015", apps: 27, goals: 3 },
    { club: "Paris Saint-Germain", years: "2015–2021", apps: 247, goals: 71 },
    { club: "Juventus", years: "2022–2023", apps: 26, goals: 4 },
    { club: "Benfica", years: "2023–2024", apps: 50, goals: 19 }]},
  { name: "Edinson Cavani", alt: ["cavani", "matador"], leagues: ["sa", "l1", "pl"], career: [
    { club: "Palermo", years: "2007–2010", apps: 109, goals: 34 },
    { club: "Napoli", years: "2010–2013", apps: 104, goals: 78 },
    { club: "Paris Saint-Germain", years: "2013–2020", apps: 226, goals: 138 },
    { club: "Manchester United", years: "2020–2022", apps: 59, goals: 20 }]},
  { name: "Thiago Silva", alt: ["thiago silva"], leagues: ["sa", "l1", "pl"], career: [
    { club: "Fluminense", years: "2006–2009", apps: 81, goals: 6 },
    { club: "AC Milan", years: "2009–2012", apps: 93, goals: 4 },
    { club: "Paris Saint-Germain", years: "2012–2020", apps: 226, goals: 17 },
    { club: "Chelsea", years: "2020–2024", apps: 113, goals: 7 }]},
  { name: "Cesc Fàbregas", alt: ["fabregas", "cesc"], leagues: ["pl", "lg", "l1"], career: [
    { club: "Arsenal", years: "2003–2011", apps: 212, goals: 35 },
    { club: "FC Barcelone", years: "2011–2014", apps: 96, goals: 28 },
    { club: "Chelsea", years: "2014–2019", apps: 138, goals: 16 },
    { club: "AS Monaco", years: "2019–2022", apps: 68, goals: 4 }]},
  { name: "David Villa", alt: ["villa", "el guaje"], leagues: ["lg"], career: [
    { club: "Real Saragosse", years: "2003–2005", apps: 73, goals: 32 },
    { club: "Valence CF", years: "2005–2010", apps: 166, goals: 108 },
    { club: "FC Barcelone", years: "2010–2013", apps: 77, goals: 33 },
    { club: "Atlético Madrid", years: "2013–2014", apps: 36, goals: 13 },
    { club: "New York City FC", years: "2015–2018", apps: 117, goals: 80 }]},
  { name: "Sergio Busquets", alt: ["busquets"], leagues: ["lg"], career: [
    { club: "FC Barcelone", years: "2008–2023", apps: 480, goals: 14 },
    { club: "Inter Miami", years: "2023–", apps: 50, goals: 3 }]},
  { name: "Gerard Piqué", alt: ["pique"], leagues: ["pl", "lg"], career: [
    { club: "Manchester United", years: "2004–2008", apps: 23, goals: 0 },
    { club: "Real Saragosse", years: "2006–2007", apps: 22, goals: 2 },
    { club: "FC Barcelone", years: "2008–2022", apps: 396, goals: 29 }]},
  { name: "Dani Alves", alt: ["dani alves", "alves"], leagues: ["lg", "sa", "l1"], career: [
    { club: "Séville FC", years: "2003–2008", apps: 174, goals: 11 },
    { club: "FC Barcelone", years: "2008–2016", apps: 391, goals: 21 },
    { club: "Juventus", years: "2016–2017", apps: 33, goals: 6 },
    { club: "Paris Saint-Germain", years: "2017–2019", apps: 73, goals: 6 },
    { club: "FC Barcelone", years: "2021–2022", apps: 17, goals: 1 }]},
  { name: "Marcelo", alt: ["marcelo", "marcelo vieira"], leagues: ["lg"], career: [
    { club: "Fluminense", years: "2005–2006", apps: 35, goals: 6 },
    { club: "Real Madrid", years: "2007–2022", apps: 546, goals: 38 }]},
  { name: "Thibaut Courtois", alt: ["courtois"], leagues: ["lg", "pl"], career: [
    { club: "KRC Genk", years: "2009–2011", apps: 77, goals: 0 },
    { club: "Atlético Madrid", years: "2011–2014", apps: 154, goals: 0 },
    { club: "Chelsea", years: "2014–2018", apps: 154, goals: 0 },
    { club: "Real Madrid", years: "2018–", apps: 250, goals: 0 }]},
  { name: "David de Gea", alt: ["de gea"], leagues: ["lg", "pl", "sa"], career: [
    { club: "Atlético Madrid", years: "2009–2011", apps: 57, goals: 0 },
    { club: "Manchester United", years: "2011–2023", apps: 545, goals: 0 },
    { club: "Fiorentina", years: "2024–", apps: 40, goals: 0 }]},
  { name: "Diego Costa", alt: ["diego costa"], leagues: ["lg", "pl"], career: [
    { club: "Atlético Madrid", years: "2010–2014", apps: 94, goals: 43 },
    { club: "Chelsea", years: "2014–2017", apps: 120, goals: 59 },
    { club: "Atlético Madrid", years: "2018–2020", apps: 81, goals: 19 }]},
  { name: "David Silva", alt: ["david silva", "el mago"], leagues: ["lg", "pl"], career: [
    { club: "Valence CF", years: "2006–2010", apps: 119, goals: 23 },
    { club: "Manchester City", years: "2010–2020", apps: 436, goals: 77 },
    { club: "Real Sociedad", years: "2020–2024", apps: 100, goals: 9 }]},
  { name: "Yaya Touré", alt: ["yaya toure", "toure"], leagues: ["l1", "lg", "pl"], career: [
    { club: "AS Monaco", years: "2006–2007", apps: 31, goals: 5 },
    { club: "FC Barcelone", years: "2007–2010", apps: 118, goals: 6 },
    { club: "Manchester City", years: "2010–2018", apps: 316, goals: 79 }]},
  { name: "Sadio Mané", alt: ["mane", "sadio mane"], leagues: ["l1", "pl", "bl"], career: [
    { club: "FC Metz", years: "2011–2012", apps: 22, goals: 2 },
    { club: "RB Salzbourg", years: "2012–2014", apps: 87, goals: 45 },
    { club: "Southampton", years: "2014–2016", apps: 75, goals: 25 },
    { club: "Liverpool", years: "2016–2022", apps: 269, goals: 120 },
    { club: "Bayern Munich", years: "2022–2023", apps: 38, goals: 12 }]},
  { name: "Riyad Mahrez", alt: ["mahrez"], leagues: ["l1", "pl"], career: [
    { club: "Le Havre", years: "2010–2014", apps: 60, goals: 6 },
    { club: "Leicester City", years: "2014–2018", apps: 179, goals: 48 },
    { club: "Manchester City", years: "2018–2023", apps: 236, goals: 78 },
    { club: "Al-Ahli", years: "2023–", apps: 60, goals: 25 }]},
  { name: "Roberto Firmino", alt: ["firmino", "bobby firmino"], leagues: ["bl", "pl"], career: [
    { club: "Hoffenheim", years: "2011–2015", apps: 153, goals: 38 },
    { club: "Liverpool", years: "2015–2023", apps: 362, goals: 111 },
    { club: "Al-Ahli", years: "2023–", apps: 60, goals: 25 }]},
  { name: "Edin Džeko", alt: ["dzeko"], leagues: ["bl", "pl", "sa"], career: [
    { club: "VfL Wolfsbourg", years: "2007–2011", apps: 111, goals: 66 },
    { club: "Manchester City", years: "2011–2015", apps: 130, goals: 50 },
    { club: "AS Roma", years: "2015–2021", apps: 260, goals: 119 },
    { club: "Inter Milan", years: "2021–2023", apps: 87, goals: 31 }]},
  { name: "Vincent Kompany", alt: ["kompany"], leagues: ["bl", "pl"], career: [
    { club: "Anderlecht", years: "2003–2006", apps: 73, goals: 5 },
    { club: "Hambourg SV", years: "2006–2008", apps: 47, goals: 2 },
    { club: "Manchester City", years: "2008–2019", apps: 360, goals: 20 }]},
  { name: "Robin van Persie", alt: ["van persie", "rvp"], leagues: ["pl"], career: [
    { club: "Feyenoord", years: "2002–2004", apps: 61, goals: 15 },
    { club: "Arsenal", years: "2004–2012", apps: 278, goals: 132 },
    { club: "Manchester United", years: "2012–2015", apps: 105, goals: 58 }]},
  { name: "Rio Ferdinand", alt: ["ferdinand", "rio"], leagues: ["pl"], career: [
    { club: "West Ham United", years: "1995–2000", apps: 127, goals: 2 },
    { club: "Leeds United", years: "2000–2002", apps: 73, goals: 3 },
    { club: "Manchester United", years: "2002–2014", apps: 455, goals: 8 }]},
  { name: "John Terry", alt: ["terry", "jt"], leagues: ["pl"], career: [
    { club: "Chelsea", years: "1998–2017", apps: 717, goals: 67 },
    { club: "Aston Villa", years: "2017–2018", apps: 36, goals: 0 }]},
  { name: "Ashley Cole", alt: ["ashley cole", "cole"], leagues: ["pl", "sa"], career: [
    { club: "Arsenal", years: "1999–2006", apps: 228, goals: 9 },
    { club: "Chelsea", years: "2006–2014", apps: 338, goals: 7 },
    { club: "AS Roma", years: "2014–2016", apps: 25, goals: 0 }]},
  { name: "Petr Čech", alt: ["cech", "petr cech"], leagues: ["l1", "pl"], career: [
    { club: "Stade Rennais", years: "2002–2004", apps: 70, goals: 0 },
    { club: "Chelsea", years: "2004–2015", apps: 494, goals: 0 },
    { club: "Arsenal", years: "2015–2019", apps: 139, goals: 0 }]},
  { name: "Hugo Lloris", alt: ["lloris"], leagues: ["l1", "pl"], career: [
    { club: "OGC Nice", years: "2005–2008", apps: 81, goals: 0 },
    { club: "Olympique Lyonnais", years: "2008–2012", apps: 202, goals: 0 },
    { club: "Tottenham Hotspur", years: "2012–2023", apps: 447, goals: 0 },
    { club: "Los Angeles FC", years: "2024–", apps: 40, goals: 0 }]},
  { name: "Alexandre Lacazette", alt: ["lacazette", "laca"], leagues: ["l1", "pl"], career: [
    { club: "Olympique Lyonnais", years: "2010–2017", apps: 275, goals: 129 },
    { club: "Arsenal", years: "2017–2022", apps: 206, goals: 71 },
    { club: "Olympique Lyonnais", years: "2022–", apps: 100, goals: 50 }]},
  { name: "Bruno Fernandes", alt: ["bruno fernandes", "bruno"], leagues: ["sa", "pl"], career: [
    { club: "Udinese", years: "2012–2013", apps: 25, goals: 0 },
    { club: "Sampdoria", years: "2013–2016", apps: 78, goals: 11 },
    { club: "Sporting CP", years: "2016–2020", apps: 137, goals: 63 },
    { club: "Manchester United", years: "2020–", apps: 280, goals: 95 }]},
  { name: "Bernardo Silva", alt: ["bernardo silva", "bernardo"], leagues: ["l1", "pl"], career: [
    { club: "AS Monaco", years: "2014–2017", apps: 109, goals: 23 },
    { club: "Manchester City", years: "2017–", apps: 400, goals: 75 }]},
  { name: "Patrice Evra", alt: ["evra"], leagues: ["l1", "pl", "sa"], career: [
    { club: "AS Monaco", years: "2002–2006", apps: 124, goals: 4 },
    { club: "Manchester United", years: "2006–2014", apps: 273, goals: 7 },
    { club: "Juventus", years: "2014–2017", apps: 82, goals: 1 },
    { club: "Olympique de Marseille", years: "2017", apps: 5, goals: 0 }]},
  { name: "David Trezeguet", alt: ["trezeguet", "trezegol"], leagues: ["l1", "sa"], career: [
    { club: "AS Monaco", years: "1995–2000", apps: 130, goals: 65 },
    { club: "Juventus", years: "2000–2010", apps: 245, goals: 138 },
    { club: "River Plate", years: "2012–2013", apps: 35, goals: 12 }]},
  { name: "Philipp Lahm", alt: ["lahm"], leagues: ["bl"], legend: true, career: [
    { club: "VfB Stuttgart", years: "2003–2005", apps: 53, goals: 4 },
    { club: "Bayern Munich", years: "2002–2017", apps: 517, goals: 16 }]},
  { name: "Bastian Schweinsteiger", alt: ["schweinsteiger", "schweini"], leagues: ["bl", "pl"], legend: true, career: [
    { club: "Bayern Munich", years: "2002–2015", apps: 500, goals: 68 },
    { club: "Manchester United", years: "2015–2017", apps: 35, goals: 2 },
    { club: "Chicago Fire", years: "2017–2019", apps: 92, goals: 8 }]},
  { name: "Samir Nasri", alt: ["nasri"], leagues: ["l1", "pl"], career: [
    { club: "Olympique de Marseille", years: "2004–2008", apps: 142, goals: 11 },
    { club: "Arsenal", years: "2008–2011", apps: 125, goals: 27 },
    { club: "Manchester City", years: "2011–2017", apps: 176, goals: 27 }]},
  { name: "Florent Malouda", alt: ["malouda"], leagues: ["l1", "pl"], career: [
    { club: "EA Guingamp", years: "2000–2003", apps: 91, goals: 14 },
    { club: "Olympique Lyonnais", years: "2003–2007", apps: 144, goals: 33 },
    { club: "Chelsea", years: "2007–2013", apps: 229, goals: 45 }]},
  { name: "Éric Abidal", alt: ["abidal"], leagues: ["l1", "lg"], career: [
    { club: "AS Monaco", years: "2002–2004", apps: 56, goals: 0 },
    { club: "Olympique Lyonnais", years: "2004–2007", apps: 98, goals: 1 },
    { club: "FC Barcelone", years: "2007–2013", apps: 142, goals: 2 },
    { club: "AS Monaco", years: "2013–2014", apps: 24, goals: 0 }]},
  { name: "Dimitri Payet", alt: ["payet"], leagues: ["l1", "pl"], career: [
    { club: "AS Saint-Étienne", years: "2007–2011", apps: 130, goals: 23 },
    { club: "Lille OSC", years: "2011–2013", apps: 67, goals: 13 },
    { club: "Olympique de Marseille", years: "2013–2015", apps: 70, goals: 16 },
    { club: "West Ham United", years: "2015–2017", apps: 48, goals: 9 },
    { club: "Olympique de Marseille", years: "2017–2023", apps: 230, goals: 60 }]},
];

// Base auto-générée (players.json) si non vide, sinon base curée ci-dessus
const PLAYERS = generated.length ? generated : CURATED;

// ---- Styles d'écussons (couleurs de club) ----
const CLUB_STYLE = {
  "Real Madrid": { bg: "#FEBE10", fg: "#00296B", short: "RMA" },
  "FC Barcelone": { bg: "#A50044", fg: "#FFD200", short: "FCB" },
  "Atlético Madrid": { bg: "#CB3524", fg: "#FFFFFF", short: "ATM" },
  "Séville FC": { bg: "#D81E05", fg: "#FFFFFF", short: "SEV" },
  "Valence CF": { bg: "#F18E00", fg: "#FFFFFF", short: "VAL" },
  "Villarreal": { bg: "#FFE667", fg: "#005187", short: "VIL" },
  "Real Sociedad": { bg: "#0067B1", fg: "#FFFFFF", short: "RSO" },
  "Real Saragosse": { bg: "#0A4CA0", fg: "#FFFFFF", short: "ZAR" },
  "RCD Majorque": { bg: "#E30613", fg: "#FFD100", short: "MLL" },
  "Celta Vigo": { bg: "#8AC3EE", fg: "#E63329", short: "CEL" },
  "Manchester United": { bg: "#DA291C", fg: "#FFFFFF", short: "MUN" },
  "Manchester City": { bg: "#6CABDD", fg: "#FFFFFF", short: "MCI" },
  "Liverpool": { bg: "#C8102E", fg: "#FFFFFF", short: "LIV" },
  "Chelsea": { bg: "#034694", fg: "#FFFFFF", short: "CHE" },
  "Arsenal": { bg: "#EF0107", fg: "#FFFFFF", short: "ARS" },
  "Tottenham Hotspur": { bg: "#FFFFFF", fg: "#132257", short: "TOT" },
  "Everton": { bg: "#003399", fg: "#FFFFFF", short: "EVE" },
  "Leicester City": { bg: "#003090", fg: "#FFFFFF", short: "LEI" },
  "Newcastle United": { bg: "#241F20", fg: "#FFFFFF", short: "NEW" },
  "West Ham United": { bg: "#7A263A", fg: "#1BB1E7", short: "WHU" },
  "Southampton": { bg: "#D71920", fg: "#FFFFFF", short: "SOU" },
  "Aston Villa": { bg: "#670E36", fg: "#95BFE5", short: "AVL" },
  "Stoke City": { bg: "#E03A3E", fg: "#FFFFFF", short: "STK" },
  "Leeds United": { bg: "#FFCD00", fg: "#1D428A", short: "LEE" },
  "Paris Saint-Germain": { bg: "#004170", fg: "#FFFFFF", short: "PSG" },
  "Olympique de Marseille": { bg: "#2FAEE0", fg: "#FFFFFF", short: "OM" },
  "Olympique Lyonnais": { bg: "#E2001A", fg: "#FFFFFF", short: "OL" },
  "AS Monaco": { bg: "#E63312", fg: "#FFFFFF", short: "ASM" },
  "Lille OSC": { bg: "#E01E13", fg: "#FFFFFF", short: "LIL" },
  "Girondins de Bordeaux": { bg: "#000035", fg: "#FFFFFF", short: "BOR" },
  "FC Nantes": { bg: "#FCD405", fg: "#008C44", short: "NAN" },
  "OGC Nice": { bg: "#C70414", fg: "#000000", short: "NIC" },
  "FC Metz": { bg: "#7D0C18", fg: "#FFFFFF", short: "FCM" },
  "Le Havre": { bg: "#0067B1", fg: "#FFFFFF", short: "HAC" },
  "Stade Rennais": { bg: "#E03A3E", fg: "#000000", short: "REN" },
  "AS Saint-Étienne": { bg: "#008C44", fg: "#FFFFFF", short: "ASSE" },
  "EA Guingamp": { bg: "#E2001A", fg: "#000000", short: "EAG" },
  "AS Cannes": { bg: "#C8102E", fg: "#FFFFFF", short: "CAN" },
  "SM Caen": { bg: "#003DA5", fg: "#E2001A", short: "SMC" },
  "Juventus": { bg: "#000000", fg: "#FFFFFF", short: "JUV" },
  "AC Milan": { bg: "#FB090B", fg: "#000000", short: "MIL" },
  "Inter Milan": { bg: "#010E80", fg: "#FFFFFF", short: "INT" },
  "AS Roma": { bg: "#8E1F2F", fg: "#F0BC42", short: "ROM" },
  "Napoli": { bg: "#007AB8", fg: "#FFFFFF", short: "NAP" },
  "Fiorentina": { bg: "#592C82", fg: "#FFFFFF", short: "FIO" },
  "Palermo": { bg: "#EF9CBB", fg: "#000000", short: "PAL" },
  "Sampdoria": { bg: "#1B5497", fg: "#FFFFFF", short: "SAM" },
  "Udinese": { bg: "#000000", fg: "#FFFFFF", short: "UDI" },
  "Parme": { bg: "#FFD200", fg: "#003B7F", short: "PAR" },
  "Brescia": { bg: "#003DA5", fg: "#FFFFFF", short: "BRE" },
  "Bayern Munich": { bg: "#DC052D", fg: "#FFFFFF", short: "BAY" },
  "Borussia Dortmund": { bg: "#FDE100", fg: "#000000", short: "BVB" },
  "Schalke 04": { bg: "#004D9D", fg: "#FFFFFF", short: "S04" },
  "Bayer Leverkusen": { bg: "#E32219", fg: "#000000", short: "B04" },
  "VfL Wolfsbourg": { bg: "#65B32E", fg: "#FFFFFF", short: "WOB" },
  "Werder Brême": { bg: "#1D9053", fg: "#FFFFFF", short: "SVW" },
  "Hambourg SV": { bg: "#1D5BAA", fg: "#FFFFFF", short: "HSV" },
  "VfB Stuttgart": { bg: "#E32219", fg: "#FFFFFF", short: "VFB" },
  "Hoffenheim": { bg: "#1C63B7", fg: "#FFFFFF", short: "TSG" },
  "RB Salzbourg": { bg: "#D40028", fg: "#FFFFFF", short: "RBS" },
  "Ajax": { bg: "#D2122E", fg: "#FFFFFF", short: "AJA" },
  "PSV Eindhoven": { bg: "#ED1C24", fg: "#FFFFFF", short: "PSV" },
  "Feyenoord": { bg: "#E30613", fg: "#FFFFFF", short: "FEY" },
  "Sporting CP": { bg: "#008057", fg: "#FFFFFF", short: "SCP" },
  "Benfica": { bg: "#E30613", fg: "#FFFFFF", short: "SLB" },
  "FC Porto": { bg: "#003F87", fg: "#FFFFFF", short: "POR" },
  "Celtic": { bg: "#018749", fg: "#FFFFFF", short: "CEL" },
  "Galatasaray": { bg: "#A90432", fg: "#FBB800", short: "GAL" },
  "Santos": { bg: "#FFFFFF", fg: "#000000", short: "SAN" },
  "Grêmio": { bg: "#0D80BF", fg: "#000000", short: "GRE" },
  "Flamengo": { bg: "#C52613", fg: "#000000", short: "FLA" },
  "Fluminense": { bg: "#7A1F2B", fg: "#00613C", short: "FLU" },
  "Inter Miami": { bg: "#F7B5CD", fg: "#000000", short: "MIA" },
  "LA Galaxy": { bg: "#00245D", fg: "#FFFFFF", short: "LAG" },
  "Los Angeles FC": { bg: "#000000", fg: "#C39E6D", short: "LAFC" },
  "New York City FC": { bg: "#6CADDF", fg: "#041E42", short: "NYC" },
  "New York Red Bulls": { bg: "#ED1E36", fg: "#002F65", short: "NYR" },
  "Orlando City": { bg: "#633492", fg: "#FFFFFF", short: "ORL" },
  "DC United": { bg: "#000000", fg: "#E41B17", short: "DCU" },
  "Chicago Fire": { bg: "#A6192E", fg: "#0A2240", short: "CHI" },
  "Al-Nassr": { bg: "#FFE600", fg: "#1B4DA1", short: "NAS" },
  "Al-Hilal": { bg: "#0046A8", fg: "#FFFFFF", short: "HIL" },
  "Al-Ittihad": { bg: "#000000", fg: "#FFB300", short: "ITT" },
  "Al-Ahli": { bg: "#007A33", fg: "#FFFFFF", short: "AHL" },
  "Al Sadd": { bg: "#000000", fg: "#FFFFFF", short: "SAD" },
  "Vissel Kobe": { bg: "#9B1B30", fg: "#000000", short: "KOB" },
};

const SKIP_WORDS = new Set(["de", "la", "le", "du", "des", "fc", "ac", "as", "sc", "cf", "rc", "rcd", "ssc", "vfl", "vfb", "afc", "cd", "ca", "ogc", "sm", "us", "ud", "ea", "krc", "rb"]);

function abbr(name) {
  const words = name.toLowerCase().replace(/[.\-']/g, " ").split(/\s+/).filter(Boolean);
  const sig = words.filter((w) => !SKIP_WORDS.has(w));
  const base = sig.length ? sig : words;
  if (base.length === 1) return base[0].slice(0, 3).toUpperCase();
  return base.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function hashStyle(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { bg: `hsl(${h} 42% 30%)`, fg: "#ffffff", short: abbr(name) };
}

function clubStyle(name) {
  return CLUB_STYLE[name] || hashStyle(name);
}

function Crest({ club, size = 36 }) {
  const s = clubStyle(club);
  return (
    <div
      style={{ background: s.bg, color: s.fg, width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg text-[10px] font-black leading-none tracking-tight shadow ring-1 ring-black/25"
    >
      {s.short}
    </div>
  );
}

// ---- Coupe aux grandes oreilles (dessin original) ----
function UclCup({ size = 18, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M15 13 C3 13 3 31 17 31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M33 13 C45 13 45 31 31 31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M13 11 H35 L31 28 Q24 33 17 28 Z" fill="currentColor" />
      <rect x="22" y="30" width="4" height="6" rx="1" fill="currentColor" />
      <path d="M16 36 H32 L35 43 H13 Z" fill="currentColor" />
    </svg>
  );
}

// ---- Drapeaux des pays (SVG inline, domaine public) ----
const flagStyle = { borderRadius: 3, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.3)" };
const wrap = (size, children, className) => (
  <svg className={className} style={flagStyle} width={Math.round(size * 1.4)} height={size} viewBox="0 0 9 6">
    {children}
  </svg>
);
const FlagFR = ({ size = 18, className = "" }) => wrap(size, (<>
  <rect width="9" height="6" fill="#fff" />
  <rect width="3" height="6" fill="#0055A4" />
  <rect x="6" width="3" height="6" fill="#EF4135" />
</>), className);
const FlagIT = ({ size = 18, className = "" }) => wrap(size, (<>
  <rect width="9" height="6" fill="#fff" />
  <rect width="3" height="6" fill="#009246" />
  <rect x="6" width="3" height="6" fill="#CE2B37" />
</>), className);
const FlagES = ({ size = 18, className = "" }) => wrap(size, (<>
  <rect width="9" height="6" fill="#AA151B" />
  <rect y="1.5" width="9" height="3" fill="#F1BF00" />
</>), className);
const FlagDE = ({ size = 18, className = "" }) => wrap(size, (<>
  <rect width="9" height="2" fill="#000" />
  <rect y="2" width="9" height="2" fill="#DD0000" />
  <rect y="4" width="9" height="2" fill="#FFCE00" />
</>), className);
const FlagEN = ({ size = 18, className = "" }) => wrap(size, (<>
  <rect width="9" height="6" fill="#fff" />
  <rect x="3.9" width="1.2" height="6" fill="#CE1124" />
  <rect y="2.4" width="9" height="1.2" fill="#CE1124" />
</>), className);

const MODES = [
  { id: "l1", label: "Ligue 1", desc: "Passés par la Ligue 1", icon: FlagFR },
  { id: "pl", label: "Premier League", desc: "Passés par la D1 anglaise", icon: FlagEN },
  { id: "sa", label: "Serie A", desc: "Passés par la D1 italienne", icon: FlagIT },
  { id: "bl", label: "Bundesliga", desc: "Passés par la D1 allemande", icon: FlagDE },
  { id: "lg", label: "Liga", desc: "Passés par la D1 espagnole", icon: FlagES },
  { id: "europe", label: "Europe", desc: "≥ 1 club du top 5", icon: Star, color: "text-amber-300" },
  { id: "global", label: "Global", desc: "Joueurs du monde entier", icon: Globe, color: "text-emerald-300" },
  { id: "legends", label: "XI de légende", desc: "Uniquement les légendes", icon: Crown, color: "text-yellow-300" },
];

function poolFor(mode) {
  if (mode === "global") return PLAYERS;
  if (mode === "legends") return PLAYERS.filter((p) => p.legend);
  if (mode === "europe") return PLAYERS.filter((p) => p.leagues && p.leagues.length > 0);
  return PLAYERS.filter((p) => p.leagues && p.leagues.includes(mode));
}

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Distance de Levenshtein : nb de modifs (ajout/suppression/remplacement) entre 2 mots
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Marge d'erreur tolérée selon la longueur du nom cible
function tolFor(len) {
  if (len <= 7) return 1;   // noms courts : 1 faute
  if (len <= 11) return 2;  // moyens : 2 fautes
  return 3;                 // longs (Schweinsteiger...) : 3 fautes
}

function close(g, target) {
  if (!g || !target) return false;
  if (g === target) return true;
  if (g.length < 3) return false; // on n'approxime pas sur 1-2 lettres
  return lev(g, target) <= tolFor(target.length);
}

function isCorrect(guess, player) {
  const g = norm(guess);
  if (!g) return false;
  const full = norm(player.name);
  if (close(g, full)) return true;
  const tokens = full.split(" ");
  const last = tokens[tokens.length - 1];
  if (last.length >= 4 && close(g, last)) return true;
  if (player.alt && player.alt.some((a) => close(g, norm(a)))) return true;
  return false;
}

function pick(pool, used) {
  let cands = pool.filter((p) => !used.includes(p.name));
  if (cands.length === 0) cands = pool;
  return cands[Math.floor(Math.random() * cands.length)];
}

const PITCH = {
  backgroundColor: "#06281a",
  backgroundImage:
    "linear-gradient(180deg, rgba(20,95,58,0.55), rgba(4,28,18,0.96)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, transparent 2px, transparent 46px)",
};

function Shell({ children, onHome, onBoard }) {
  return (
    <div className="min-h-screen w-full text-emerald-50" style={PITCH}>
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6">
        <header className="mb-5 flex items-center justify-between">
          <button onClick={onHome} className="flex items-center gap-2 text-left">
            <span className="text-2xl">⚽</span>
            <div>
              <h1 className="text-lg font-black leading-none tracking-tight">J'ai joué à</h1>
              <p className="text-[11px] uppercase tracking-widest text-emerald-300/80">le jeu de transferts</p>
            </div>
          </button>
          <button
            onClick={onBoard}
            className="flex items-center gap-1.5 rounded-full bg-emerald-900/60 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-emerald-300/15 hover:bg-emerald-900"
          >
            <UclCup size={16} className="text-amber-200" /> Classement
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [pseudo, setPseudo] = useState("");
  const [mode, setMode] = useState("global");

  const [player, setPlayer] = useState(null);
  const [hint, setHint] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [used, setUsed] = useState([]);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null);
  const [boardCat, setBoardCat] = useState("global");
  const [boardRows, setBoardRows] = useState([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardNonce, setBoardNonce] = useState(0);

  const potential = 3 - hint;

  const startGame = () => {
    if (!poolFor(mode).length) return;
    const first = pick(poolFor(mode), []);
    setPlayer(first);
    setUsed([first.name]);
    setHint(0); setScore(0); setStreak(0); setGuess(""); setResult(null);
    setScreen("game");
  };

  const nextPlayer = () => {
    const next = pick(poolFor(mode), used);
    setPlayer(next);
    setUsed((u) => [...u, next.name]);
    setHint(0); setGuess(""); setResult(null);
  };

  const saveRun = async (s, k) => {
    try {
      await addDoc(collection(db, "runs"), {
        pseudo: (pseudo || "Joueur").slice(0, 24),
        mode,
        points: s,
        correct: k,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Firestore (écriture) :", e);
    }
  };

  // Charge le classement de la catégorie sélectionnée à l'ouverture de l'écran
  useEffect(() => {
    if (screen !== "board") return;
    let cancel = false;
    setBoardLoading(true);
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "runs"), where("mode", "==", boardCat)));
        const rows = snap.docs
          .map((d) => d.data())
          .sort((a, b) => b.points - a.points || b.correct - a.correct)
          .slice(0, 20);
        if (!cancel) setBoardRows(rows);
      } catch (e) {
        console.error("Firestore (lecture) :", e);
        if (!cancel) setBoardRows([]);
      } finally {
        if (!cancel) setBoardLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [screen, boardCat, boardNonce]);

  const submit = () => {
    if (!guess.trim() || (result && result.ok)) return;
    if (isCorrect(guess, player)) {
      const pts = potential;
      setScore(score + pts);
      setStreak(streak + 1);
      setResult({ ok: true, name: player.name, pts });
    } else {
      saveRun(score, streak);
      setResult({ ok: false, name: player.name });
      setScreen("gameover");
    }
  };

  const endVoluntarily = () => {
    saveRun(score, streak);
    setResult({ ok: false, name: null, banked: true });
    setScreen("gameover");
  };

  // HOME
  if (screen === "home") {
    return (
      <Shell onHome={() => setScreen("home")} onBoard={() => setScreen("board")}>
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-emerald-300/70">
            Ton pseudo
          </label>
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="ex. Quentin"
            className="w-full rounded-xl border border-emerald-300/15 bg-emerald-950/50 px-4 py-3 text-base outline-none ring-emerald-400/50 placeholder:text-emerald-200/30 focus:ring-2"
          />
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300/70">Mode de jeu</p>
        <div className="grid grid-cols-2 gap-2.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/40"
                    : "border-emerald-300/12 bg-emerald-950/40 hover:bg-emerald-900/40"
                }`}
              >
                <Icon size={20} className={`mb-1.5 ${m.color || ""}`} />
                <div className="text-sm font-bold leading-tight">{m.label}</div>
                <div className="text-[11px] leading-tight text-emerald-200/50">{m.desc}</div>
                <div className="mt-1 text-[10px] text-emerald-200/40">{poolFor(m.id).length} joueurs</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={startGame}
          className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[.99]"
        >
          Lancer une partie <ChevronRight size={20} />
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-emerald-200/40">
          3 pts sans indice · 2 pts avec les années · 1 pt avec années + stats.<br />
          Une mauvaise réponse = fin de partie. (Stats matchs/buts approximatives.)
        </p>
      </Shell>
    );
  }

  // GAME
  if (screen === "game" && player) {
    return (
      <Shell onHome={() => setScreen("home")} onBoard={() => setScreen("board")}>
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-300/12 bg-emerald-950/50 px-4 py-2.5 text-sm">
          <span className="truncate font-bold">{pseudo || "Joueur"}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-300"><Award size={15} /> <b>{score}</b> pts</span>
            <span className="flex items-center gap-1 text-amber-300">🔥 <b>{streak}</b></span>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-center gap-2">
          {[3, 2, 1].map((v) => (
            <div
              key={v}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition ${
                potential === v
                  ? "bg-emerald-500 text-emerald-950 ring-2 ring-emerald-300"
                  : "bg-emerald-950/60 text-emerald-200/40"
              } ${v > potential ? "line-through" : ""}`}
            >
              {v}
            </div>
          ))}
          <span className="ml-1 text-xs text-emerald-200/50">pts en jeu</span>
        </div>

        <div className="rounded-2xl border border-emerald-300/12 bg-emerald-950/45 p-1.5">
          <div className="border-b border-emerald-300/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/60">
            Parcours senior
          </div>
          <ul className="divide-y divide-emerald-300/8">
            {player.career.map((c, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Crest club={c.club} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{c.club}</div>
                  {hint >= 1 && <div className="text-xs text-emerald-300/90">{c.years || "?"}</div>}
                </div>
                {hint >= 2 && (
                  <div className="shrink-0 text-right text-[11px] text-emerald-200/55">
                    <span className="font-semibold text-emerald-100">{c.apps ?? "—"}</span> matchs<br />
                    <span className="font-semibold text-emerald-100">{c.goals ?? "—"}</span> buts
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            disabled={hint >= 1 || (result && result.ok)}
            onClick={() => setHint(1)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/12 bg-emerald-950/50 py-2.5 text-xs font-semibold disabled:opacity-40"
          >
            <HelpCircle size={14} /> Indice 1 · années
          </button>
          <button
            disabled={hint >= 2 || (result && result.ok)}
            onClick={() => setHint(2)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/12 bg-emerald-950/50 py-2.5 text-xs font-semibold disabled:opacity-40"
          >
            <HelpCircle size={14} /> Indice 2 · stats
          </button>
        </div>

        {result && result.ok ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-300">
              <Check size={20} /> <span className="font-black">Bravo !</span>
            </div>
            <p className="mt-1 text-sm">C'était <b>{result.name}</b> — <b className="text-emerald-300">+{result.pts} pts</b></p>
            <button
              onClick={nextPlayer}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-emerald-950 hover:bg-emerald-400"
            >
              Joueur suivant <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Quel joueur ?"
                className="flex-1 rounded-xl border border-emerald-300/15 bg-emerald-950/50 px-4 py-3 text-base outline-none ring-emerald-400/50 placeholder:text-emerald-200/30 focus:ring-2"
              />
              <button onClick={submit} className="rounded-xl bg-emerald-500 px-5 font-black text-emerald-950 hover:bg-emerald-400">
                OK
              </button>
            </div>
            <button
              onClick={endVoluntarily}
              className="mt-3 w-full text-center text-xs text-emerald-200/40 underline-offset-2 hover:text-emerald-200/70 hover:underline"
            >
              Terminer la partie et enregistrer le score
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // GAME OVER
  if (screen === "gameover") {
    const full = result?.name ? PLAYERS.find((p) => p.name === result.name) : null;
    return (
      <Shell onHome={() => setScreen("home")} onBoard={() => setScreen("board")}>
        <div className={`rounded-2xl border p-5 text-center ${result?.banked ? "border-emerald-400/40 bg-emerald-500/10" : "border-rose-400/40 bg-rose-500/10"}`}>
          {result?.banked ? <UclCup size={42} className="mx-auto text-amber-300" /> : <X size={40} className="mx-auto text-rose-300" />}
          <h2 className="mt-2 text-xl font-black">{result?.banked ? "Partie terminée" : "Fin de partie !"}</h2>
          {!result?.banked && result?.name && (
            <p className="mt-1 text-sm text-emerald-100/80">La réponse était <b className="text-rose-200">{result.name}</b></p>
          )}
          <div className="mt-4 flex items-center justify-center gap-6">
            <div>
              <div className="text-3xl font-black text-emerald-300">{score}</div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-200/50">points</div>
            </div>
            <div>
              <div className="text-3xl font-black text-amber-300">{streak}</div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-200/50">série</div>
            </div>
          </div>
        </div>

        {full && (
          <div className="mt-3 rounded-2xl border border-emerald-300/12 bg-emerald-950/45 p-1.5">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/60">Le parcours complet</div>
            <ul className="divide-y divide-emerald-300/8">
              {full.career.map((c, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Crest club={c.club} size={30} />
                  <span className="flex-1 font-semibold">{c.club}</span>
                  <span className="text-xs text-emerald-200/50">{c.years || "?"} · {c.apps ?? "—"}m / {c.goals ?? "—"}b</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={startGame} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 font-black text-emerald-950 hover:bg-emerald-400">
            <RotateCcw size={16} /> Rejouer
          </button>
          <button onClick={() => setScreen("board")} className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/12 bg-emerald-950/50 py-3 font-bold">
            <UclCup size={16} className="text-amber-200" /> Classement
          </button>
        </div>
        <button onClick={() => setScreen("home")} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300/12 bg-emerald-950/40 py-2.5 text-sm font-semibold text-emerald-100/80">
          <Home size={15} /> Menu
        </button>
      </Shell>
    );
  }

  // LEADERBOARD
  if (screen === "board") {
    return (
      <Shell onHome={() => setScreen("home")} onBoard={() => setScreen("board")}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UclCup size={24} className="text-amber-300" />
            <h2 className="text-lg font-black">Classement</h2>
          </div>
          <button
            onClick={() => setBoardNonce((n) => n + 1)}
            className="rounded-full bg-emerald-900/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/15 hover:bg-emerald-900"
          >
            Actualiser
          </button>
        </div>

        {/* Onglets par catégorie de jeu */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setBoardCat(m.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                boardCat === m.id
                  ? "bg-emerald-500 text-emerald-950"
                  : "bg-emerald-950/50 text-emerald-200/70 ring-1 ring-emerald-300/12 hover:bg-emerald-900/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mb-3 text-[11px] text-emerald-200/40">Meilleures séries — classé par points, puis par longueur de série.</p>

        {boardLoading ? (
          <div className="rounded-2xl border border-emerald-300/12 bg-emerald-950/40 p-8 text-center text-sm text-emerald-200/50">
            Chargement…
          </div>
        ) : boardRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-300/20 p-8 text-center text-sm text-emerald-200/40">
            Aucune partie enregistrée dans cette catégorie.
          </div>
        ) : (
          <ul className="space-y-2">
            {boardRows.map((r, i) => (
              <li key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${i === 0 ? "border-amber-400/40 bg-amber-500/10" : "border-emerald-300/12 bg-emerald-950/40"}`}>
                <span className={`w-6 text-center text-sm font-black ${i === 0 ? "text-amber-300" : "text-emerald-200/50"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{r.pseudo}</div>
                  <div className="text-[11px] text-emerald-200/45">série de {r.correct}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-300">{r.points}</div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-200/40">pts</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button onClick={() => setScreen("home")} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 font-black text-emerald-950 hover:bg-emerald-400">
          <Home size={16} /> Retour au menu
        </button>
      </Shell>
    );
  }

  return null;
}
