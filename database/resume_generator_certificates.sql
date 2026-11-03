CREATE DATABASE  IF NOT EXISTS `resume_generator` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `resume_generator`;
-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: resume_generator
-- ------------------------------------------------------
-- Server version	8.0.43

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
-- Table structure for table `certificates`
--

DROP TABLE IF EXISTS `certificates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `certificates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `upload_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `certificates_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `certificates`
--

LOCK TABLES `certificates` WRITE;
/*!40000 ALTER TABLE `certificates` DISABLE KEYS */;
INSERT INTO `certificates` VALUES (1,1,'certificate-1757165991079-919730374.jpg','WhatsApp Image 2025-08-25 at 16.32.41_dc126651.jpg',NULL,'2025-09-06 13:39:51'),(2,1,'certificate-1757166433999-398756689.jpg','WhatsApp Image 2025-08-25 at 16.32.41_490fa9f4.jpg',NULL,'2025-09-06 13:47:14'),(3,1,'certificate-1757175125253-947856486.jpg','WhatsApp Image 2025-08-25 at 16.32.42_be7fb5cc.jpg',NULL,'2025-09-06 16:12:05'),(4,1,'certificate-1757177005167-433939097.jpg','Introduction to Psychology.jpg',NULL,'2025-09-06 16:43:25'),(5,1,'certificate-1757177011076-52569338.jpg','Introduction to AI.jpg',NULL,'2025-09-06 16:43:31'),(6,1,'certificate-1757177012476-645525191.jpg','Introduction to AI.jpg',NULL,'2025-09-06 16:43:32'),(7,1,'certificate-1757177013518-33779100.jpg','Introduction to AI.jpg',NULL,'2025-09-06 16:43:33'),(8,1,'certificate-1757177015226-472553829.jpg','Introduction to AI.jpg',NULL,'2025-09-06 16:43:35'),(9,1,'certificate-1757177080787-793483106.jpg','Introduction to Psychology.jpg',NULL,'2025-09-06 16:44:40'),(10,1,'certificate-1757177172983-197943390.jpg','Introduction to AI.jpg',NULL,'2025-09-06 16:46:12'),(11,2,'certificate-1757177700875-51616067.jpg','Introduction to AI.jpg',NULL,'2025-09-06 16:55:00'),(12,2,'certificate-1757179080234-356276859.jpg','Introduction to Psychology.jpg',NULL,'2025-09-06 17:18:00'),(13,1,'certificate-1757179824273-294904889.jpg','WhatsApp Image 2025-08-25 at 16.32.41_490fa9f4.jpg',NULL,'2025-09-06 17:30:24'),(14,2,'certificate-1757726897920-198838129.pdf','Programming Foundations Fundamentals.pdf',NULL,'2025-09-13 01:28:17'),(15,2,'certificate-1757727658376-667961309.pdf','Programming Foundations Beyond the Fundamentals.pdf',NULL,'2025-09-13 01:40:58'),(16,1,'certificate-1757729783463-941228308.pdf','participation_certificate.pdf',NULL,'2025-09-13 02:16:23'),(17,1,'certificate-1757729821032-812452841.pdf','Learning Java 17 .pdf',NULL,'2025-09-13 02:17:01');
/*!40000 ALTER TABLE `certificates` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-13 12:52:21
