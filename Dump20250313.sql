CREATE DATABASE  IF NOT EXISTS `quiz_musical_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `quiz_musical_db`;
-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: quiz_musical_db
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `gamemaster`
--

DROP TABLE IF EXISTS `gamemaster`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gamemaster` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nickname` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gamemaster`
--

LOCK TABLES `gamemaster` WRITE;
/*!40000 ALTER TABLE `gamemaster` DISABLE KEYS */;
INSERT INTO `gamemaster` VALUES (1,'test@test.com','$2b$10$jk1FV7cmdGl2dioKM9NgouXmsLE4rwRi7sbcC0sP29eXEraOn6VM2','LeMaître','2025-02-15 09:16:04');
/*!40000 ALTER TABLE `gamemaster` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parties`
--

DROP TABLE IF EXISTS `parties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gamemaster_id` int NOT NULL,
  `theme_id` int NOT NULL,
  `code` varchar(6) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `started` tinyint(1) DEFAULT '0',
  `finished` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `gamemaster_id` (`gamemaster_id`),
  KEY `theme_id` (`theme_id`),
  CONSTRAINT `parties_ibfk_1` FOREIGN KEY (`gamemaster_id`) REFERENCES `gamemaster` (`id`),
  CONSTRAINT `parties_ibfk_2` FOREIGN KEY (`theme_id`) REFERENCES `themes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parties`
--

LOCK TABLES `parties` WRITE;
/*!40000 ALTER TABLE `parties` DISABLE KEYS */;
INSERT INTO `parties` VALUES (2,1,1,'809128','2025-02-15 10:42:16',0,0),(3,1,1,'577866','2025-02-17 11:48:36',0,0),(4,1,1,'175581','2025-02-17 12:16:26',0,0),(5,1,1,'401438','2025-02-17 16:17:52',0,0),(6,1,1,'834272','2025-02-17 21:28:51',0,0),(7,1,1,'372211','2025-02-17 22:53:06',0,0),(8,1,1,'476510','2025-02-19 09:46:45',0,0),(9,1,1,'952455','2025-02-19 10:30:37',0,0),(10,1,1,'312156','2025-02-19 10:31:30',0,0),(11,1,1,'747132','2025-02-19 10:33:10',0,0),(12,1,1,'848879','2025-02-19 10:44:25',0,0),(13,1,1,'484898','2025-02-20 12:17:44',0,0),(14,1,1,'404776','2025-02-20 13:09:21',0,0),(15,1,1,'425138','2025-02-20 14:01:21',0,0),(16,1,1,'264555','2025-02-20 14:28:05',0,0),(17,1,1,'841737','2025-02-20 14:31:41',0,0),(18,1,1,'510979','2025-02-20 14:50:36',0,0),(19,1,1,'785169','2025-02-20 15:34:28',0,0),(20,1,1,'656858','2025-02-20 15:45:36',0,0),(21,1,1,'646811','2025-02-20 15:51:25',0,0),(22,1,1,'275406','2025-02-20 15:59:39',0,0),(23,1,1,'625468','2025-02-21 10:24:29',0,0),(24,1,1,'980659','2025-02-24 12:23:18',0,0),(25,1,1,'840988','2025-02-24 14:17:58',0,0),(26,1,1,'288976','2025-02-24 15:15:49',0,0),(27,1,1,'749199','2025-02-24 15:55:44',0,0),(28,1,1,'751740','2025-02-26 15:51:23',0,0),(29,1,1,'693294','2025-03-06 15:48:20',0,0),(30,1,1,'642350','2025-03-10 15:45:05',0,0),(31,1,1,'239337','2025-03-13 15:20:05',0,0);
/*!40000 ALTER TABLE `parties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `players`
--

DROP TABLE IF EXISTS `players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `players` (
  `id` int NOT NULL AUTO_INCREMENT,
  `party_id` int NOT NULL,
  `nickname` varchar(50) NOT NULL,
  `connected` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `score` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `party_id` (`party_id`),
  CONSTRAINT `players_ibfk_1` FOREIGN KEY (`party_id`) REFERENCES `parties` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `players`
--

LOCK TABLES `players` WRITE;
/*!40000 ALTER TABLE `players` DISABLE KEYS */;
INSERT INTO `players` VALUES (16,25,'Viva',1,'2025-02-24 14:18:06',3),(17,25,'Bichette',1,'2025-02-24 14:18:13',13),(18,26,'Viva',1,'2025-02-24 15:15:54',18),(19,27,'Viva',1,'2025-02-24 15:55:49',46),(20,28,'Viva',1,'2025-02-26 15:52:17',35),(21,29,'Bichette',1,'2025-03-06 15:48:27',9),(22,30,'VivaTheBoss',1,'2025-03-10 15:45:13',-6),(23,31,'Viva',1,'2025-03-13 15:20:13',39);
/*!40000 ALTER TABLE `players` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `songs`
--

DROP TABLE IF EXISTS `songs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `songs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `theme_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `mp3_url` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `theme_id` (`theme_id`),
  CONSTRAINT `songs_ibfk_1` FOREIGN KEY (`theme_id`) REFERENCES `themes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `songs`
--

LOCK TABLES `songs` WRITE;
/*!40000 ALTER TABLE `songs` DISABLE KEYS */;
INSERT INTO `songs` VALUES (1,1,'Song 1','/MP3/01_dj_isaac_-_feel_so_good_(creeds_remix).mp3'),(2,1,'Song 2','/MP3/02_frontliner_and_nlck_-_we_dance.mp3'),(3,1,'Song 3','/MP3/03_mutilator_so_juice_and_fraw_-_stfu.mp3'),(4,1,'Song 4','/MP3/04_the_straikerz_-_beat_of_the_drum.mp3'),(5,1,'Song 5','/MP3/05_keltek_-_through_the_night_(erabreak_remix).mp3'),(6,1,'Song 6','/MP3/06_devin_wild_and_phuture_noize_-_antidote.mp3'),(7,1,'Song 7','/MP3/07_zany_-_angel_of_the_sun_(ephoric_remix).mp3'),(8,1,'Song 8','/MP3/08_static_and_j-kay_-_dreams.mp3'),(9,1,'Song 9','/MP3/09_digital_punk_-_fragments_(feat_sabacca_-_vasto_remix).mp3'),(10,1,'Song 10','/MP3/10_d-note_-_the_mystery.mp3');
/*!40000 ALTER TABLE `songs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `themes`
--

DROP TABLE IF EXISTS `themes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `themes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `theme_name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `themes`
--

LOCK TABLES `themes` WRITE;
/*!40000 ALTER TABLE `themes` DISABLE KEYS */;
INSERT INTO `themes` VALUES (1,'Années 80');
/*!40000 ALTER TABLE `themes` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-03-13 17:01:18
