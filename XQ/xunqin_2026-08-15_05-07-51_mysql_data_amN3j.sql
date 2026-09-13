-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: xunqin
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `xq_ac_blyt`
--

DROP TABLE IF EXISTS `xq_ac_blyt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_blyt` (
  `lever` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_blyt_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_blyt`
--

LOCK TABLES `xq_ac_blyt` WRITE;
/*!40000 ALTER TABLE `xq_ac_blyt` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_blyt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_bpdzz_gangs`
--

DROP TABLE IF EXISTS `xq_ac_bpdzz_gangs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_bpdzz_gangs` (
  `id` bigint DEFAULT NULL,
  `jf` bigint DEFAULT NULL,
  KEY `idx_xq_ac_bpdzz_gangs_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_bpdzz_gangs`
--

LOCK TABLES `xq_ac_bpdzz_gangs` WRITE;
/*!40000 ALTER TABLE `xq_ac_bpdzz_gangs` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_bpdzz_gangs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_bpdzz_player`
--

DROP TABLE IF EXISTS `xq_ac_bpdzz_player`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_bpdzz_player` (
  `get_times` bigint DEFAULT NULL,
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `rewards` longtext,
  `sum_times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_bpdzz_player_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_bpdzz_player`
--

LOCK TABLES `xq_ac_bpdzz_player` WRITE;
/*!40000 ALTER TABLE `xq_ac_bpdzz_player` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_bpdzz_player` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_bpdzz_task`
--

DROP TABLE IF EXISTS `xq_ac_bpdzz_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_bpdzz_task` (
  `end_time` bigint DEFAULT NULL,
  `gainner` longtext,
  `id` bigint DEFAULT NULL,
  `k` varchar(512) DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  `start_time` bigint DEFAULT NULL,
  `status` bigint DEFAULT NULL,
  KEY `idx_xq_ac_bpdzz_task_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_bpdzz_task`
--

LOCK TABLES `xq_ac_bpdzz_task` WRITE;
/*!40000 ALTER TABLE `xq_ac_bpdzz_task` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_bpdzz_task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_chuidiao`
--

DROP TABLE IF EXISTS `xq_ac_chuidiao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_chuidiao` (
  `free_times` bigint DEFAULT NULL,
  `fufei_times` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_chuidiao_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_chuidiao`
--

LOCK TABLES `xq_ac_chuidiao` WRITE;
/*!40000 ALTER TABLE `xq_ac_chuidiao` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_chuidiao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_cjwd`
--

DROP TABLE IF EXISTS `xq_ac_cjwd`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_cjwd` (
  `list_index` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_cjwd_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_cjwd`
--

LOCK TABLES `xq_ac_cjwd` WRITE;
/*!40000 ALTER TABLE `xq_ac_cjwd` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_cjwd` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_cwbk`
--

DROP TABLE IF EXISTS `xq_ac_cwbk`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_cwbk` (
  `id` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `start` bigint DEFAULT NULL,
  KEY `idx_xq_ac_cwbk_id` (`id`),
  KEY `idx_xq_ac_cwbk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_cwbk`
--

LOCK TABLES `xq_ac_cwbk` WRITE;
/*!40000 ALTER TABLE `xq_ac_cwbk` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_cwbk` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_day_limit`
--

DROP TABLE IF EXISTS `xq_ac_day_limit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_day_limit` (
  `fangsheng` varchar(512) DEFAULT NULL,
  `hf` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `yuebing` bigint DEFAULT NULL,
  `zhuling` bigint DEFAULT NULL,
  KEY `idx_xq_ac_day_limit_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_day_limit`
--

LOCK TABLES `xq_ac_day_limit` WRITE;
/*!40000 ALTER TABLE `xq_ac_day_limit` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_day_limit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_day_qiandao`
--

DROP TABLE IF EXISTS `xq_ac_day_qiandao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_day_qiandao` (
  `gain` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_day_qiandao_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_day_qiandao`
--

LOCK TABLES `xq_ac_day_qiandao` WRITE;
/*!40000 ALTER TABLE `xq_ac_day_qiandao` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_day_qiandao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_dzfsb_log`
--

DROP TABLE IF EXISTS `xq_ac_dzfsb_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_dzfsb_log` (
  `log` longtext,
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_dzfsb_log_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_dzfsb_log`
--

LOCK TABLES `xq_ac_dzfsb_log` WRITE;
/*!40000 ALTER TABLE `xq_ac_dzfsb_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_dzfsb_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_farm`
--

DROP TABLE IF EXISTS `xq_ac_farm`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_farm` (
  `gain` longtext,
  `name` varchar(512) DEFAULT NULL,
  `td` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_farm_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_farm`
--

LOCK TABLES `xq_ac_farm` WRITE;
/*!40000 ALTER TABLE `xq_ac_farm` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_farm` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_ac_farm_view`
--

DROP TABLE IF EXISTS `xq_ac_farm_view`;
/*!50001 DROP VIEW IF EXISTS `xq_ac_farm_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_ac_farm_view` AS SELECT 
 1 AS `gain`,
 1 AS `name`,
 1 AS `td`,
 1 AS `times`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_ac_hhbk`
--

DROP TABLE IF EXISTS `xq_ac_hhbk`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_hhbk` (
  `created` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `open_box2` bigint DEFAULT NULL,
  `open_box3` bigint DEFAULT NULL,
  `search_res` longtext,
  `sheng_pos` bigint DEFAULT NULL,
  `si_mon_num` bigint DEFAULT NULL,
  `yaoshi_num` bigint DEFAULT NULL,
  KEY `idx_xq_ac_hhbk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_hhbk`
--

LOCK TABLES `xq_ac_hhbk` WRITE;
/*!40000 ALTER TABLE `xq_ac_hhbk` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_hhbk` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_holiday_gift`
--

DROP TABLE IF EXISTS `xq_ac_holiday_gift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_holiday_gift` (
  `g0` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_holiday_gift_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_holiday_gift`
--

LOCK TABLES `xq_ac_holiday_gift` WRITE;
/*!40000 ALTER TABLE `xq_ac_holiday_gift` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_holiday_gift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_jifen`
--

DROP TABLE IF EXISTS `xq_ac_jifen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_jifen` (
  `jnzpjf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `zpjf` bigint DEFAULT NULL,
  KEY `idx_xq_ac_jifen_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_jifen`
--

LOCK TABLES `xq_ac_jifen` WRITE;
/*!40000 ALTER TABLE `xq_ac_jifen` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_jifen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_jijin`
--

DROP TABLE IF EXISTS `xq_ac_jijin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_jijin` (
  `gain0` longtext,
  `gain1` longtext,
  `name` varchar(512) DEFAULT NULL,
  `unlock0` varchar(512) DEFAULT NULL,
  `unlock1` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_jijin_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_jijin`
--

LOCK TABLES `xq_ac_jijin` WRITE;
/*!40000 ALTER TABLE `xq_ac_jijin` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_jijin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_jimai`
--

DROP TABLE IF EXISTS `xq_ac_jimai`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_jimai` (
  `bzj` varchar(512) DEFAULT NULL,
  `created` varchar(512) DEFAULT NULL,
  `endday` bigint DEFAULT NULL,
  `gd` varchar(512) DEFAULT NULL,
  `gdtype` bigint DEFAULT NULL,
  `id` bigint DEFAULT NULL,
  `kword` longtext,
  `name` varchar(512) DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  `price` bigint DEFAULT NULL,
  `pricetype` bigint DEFAULT NULL,
  `type` bigint DEFAULT NULL,
  KEY `idx_xq_ac_jimai_id` (`id`),
  KEY `idx_xq_ac_jimai_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_jimai`
--

LOCK TABLES `xq_ac_jimai` WRITE;
/*!40000 ALTER TABLE `xq_ac_jimai` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_jimai` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_ac_jimai_view`
--

DROP TABLE IF EXISTS `xq_ac_jimai_view`;
/*!50001 DROP VIEW IF EXISTS `xq_ac_jimai_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_ac_jimai_view` AS SELECT 
 1 AS `bzj`,
 1 AS `created`,
 1 AS `endday`,
 1 AS `gd`,
 1 AS `gdtype`,
 1 AS `id`,
 1 AS `kword`,
 1 AS `name`,
 1 AS `num`,
 1 AS `price`,
 1 AS `pricetype`,
 1 AS `type`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_ac_jingji`
--

DROP TABLE IF EXISTS `xq_ac_jingji`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_jingji` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_jingji_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_jingji`
--

LOCK TABLES `xq_ac_jingji` WRITE;
/*!40000 ALTER TABLE `xq_ac_jingji` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_jingji` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_jizi`
--

DROP TABLE IF EXISTS `xq_ac_jizi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_jizi` (
  `name` varchar(512) DEFAULT NULL,
  `sub` longtext,
  KEY `idx_xq_ac_jizi_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_jizi`
--

LOCK TABLES `xq_ac_jizi` WRITE;
/*!40000 ALTER TABLE `xq_ac_jizi` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_jizi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_juling`
--

DROP TABLE IF EXISTS `xq_ac_juling`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_juling` (
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_juling_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_juling`
--

LOCK TABLES `xq_ac_juling` WRITE;
/*!40000 ALTER TABLE `xq_ac_juling` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_juling` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_leijidang`
--

DROP TABLE IF EXISTS `xq_ac_leijidang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_leijidang` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_leijidang_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_leijidang`
--

LOCK TABLES `xq_ac_leijidang` WRITE;
/*!40000 ALTER TABLE `xq_ac_leijidang` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_leijidang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_ljd_gold`
--

DROP TABLE IF EXISTS `xq_ac_ljd_gold`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_ljd_gold` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `old_jf` bigint DEFAULT NULL,
  KEY `idx_xq_ac_ljd_gold_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_ljd_gold`
--

LOCK TABLES `xq_ac_ljd_gold` WRITE;
/*!40000 ALTER TABLE `xq_ac_ljd_gold` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_ljd_gold` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_ljd_xianjue`
--

DROP TABLE IF EXISTS `xq_ac_ljd_xianjue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_ljd_xianjue` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `old_jf` bigint DEFAULT NULL,
  KEY `idx_xq_ac_ljd_xianjue_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_ljd_xianjue`
--

LOCK TABLES `xq_ac_ljd_xianjue` WRITE;
/*!40000 ALTER TABLE `xq_ac_ljd_xianjue` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_ljd_xianjue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_lv_gift`
--

DROP TABLE IF EXISTS `xq_ac_lv_gift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_lv_gift` (
  `gain` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_lv_gift_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_lv_gift`
--

LOCK TABLES `xq_ac_lv_gift` WRITE;
/*!40000 ALTER TABLE `xq_ac_lv_gift` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_lv_gift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_mjxw`
--

DROP TABLE IF EXISTS `xq_ac_mjxw`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_mjxw` (
  `name` varchar(512) DEFAULT NULL,
  `r1` longtext,
  `r2` longtext,
  `r3` longtext,
  KEY `idx_xq_ac_mjxw_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_mjxw`
--

LOCK TABLES `xq_ac_mjxw` WRITE;
/*!40000 ALTER TABLE `xq_ac_mjxw` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_mjxw` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_msjl_msg`
--

DROP TABLE IF EXISTS `xq_ac_msjl_msg`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_msjl_msg` (
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_msjl_msg_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_msjl_msg`
--

LOCK TABLES `xq_ac_msjl_msg` WRITE;
/*!40000 ALTER TABLE `xq_ac_msjl_msg` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_msjl_msg` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_open_server_buy_gift`
--

DROP TABLE IF EXISTS `xq_ac_open_server_buy_gift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_open_server_buy_gift` (
  `g0` varchar(512) DEFAULT NULL,
  `g1` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_open_server_buy_gift_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_open_server_buy_gift`
--

LOCK TABLES `xq_ac_open_server_buy_gift` WRITE;
/*!40000 ALTER TABLE `xq_ac_open_server_buy_gift` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_open_server_buy_gift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_open_server_lv_gift`
--

DROP TABLE IF EXISTS `xq_ac_open_server_lv_gift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_open_server_lv_gift` (
  `g0` varchar(512) DEFAULT NULL,
  `g1` varchar(512) DEFAULT NULL,
  `g2` varchar(512) DEFAULT NULL,
  `g3` varchar(512) DEFAULT NULL,
  `g4` varchar(512) DEFAULT NULL,
  `g5` varchar(512) DEFAULT NULL,
  `g6` varchar(512) DEFAULT NULL,
  `g7` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_open_server_lv_gift_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_open_server_lv_gift`
--

LOCK TABLES `xq_ac_open_server_lv_gift` WRITE;
/*!40000 ALTER TABLE `xq_ac_open_server_lv_gift` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_open_server_lv_gift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_open_server_qiandao_gift`
--

DROP TABLE IF EXISTS `xq_ac_open_server_qiandao_gift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_open_server_qiandao_gift` (
  `day_sum` bigint DEFAULT NULL,
  `gain` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_open_server_qiandao_gift_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_open_server_qiandao_gift`
--

LOCK TABLES `xq_ac_open_server_qiandao_gift` WRITE;
/*!40000 ALTER TABLE `xq_ac_open_server_qiandao_gift` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_open_server_qiandao_gift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_paiwei`
--

DROP TABLE IF EXISTS `xq_ac_paiwei`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_paiwei` (
  `jd` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_paiwei_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_paiwei`
--

LOCK TABLES `xq_ac_paiwei` WRITE;
/*!40000 ALTER TABLE `xq_ac_paiwei` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_paiwei` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_person_jj`
--

DROP TABLE IF EXISTS `xq_ac_person_jj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_person_jj` (
  `jd` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_person_jj_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_person_jj`
--

LOCK TABLES `xq_ac_person_jj` WRITE;
/*!40000 ALTER TABLE `xq_ac_person_jj` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_person_jj` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_pet_lunjian`
--

DROP TABLE IF EXISTS `xq_ac_pet_lunjian`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_pet_lunjian` (
  `name` varchar(512) DEFAULT NULL,
  `pet` longtext,
  KEY `idx_xq_ac_pet_lunjian_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_pet_lunjian`
--

LOCK TABLES `xq_ac_pet_lunjian` WRITE;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_pet_lunjian_person`
--

DROP TABLE IF EXISTS `xq_ac_pet_lunjian_person`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_pet_lunjian_person` (
  `bmf_type` bigint DEFAULT NULL,
  `bmf_v` varchar(512) DEFAULT NULL,
  `created` varchar(512) DEFAULT NULL,
  `jj_type` bigint DEFAULT NULL,
  `jj_v` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_pet_lunjian_person_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_pet_lunjian_person`
--

LOCK TABLES `xq_ac_pet_lunjian_person` WRITE;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian_person` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian_person` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_pet_lunjian_person_sign`
--

DROP TABLE IF EXISTS `xq_ac_pet_lunjian_person_sign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_pet_lunjian_person_sign` (
  `fail_times` bigint DEFAULT NULL,
  `jf` bigint DEFAULT NULL,
  `members` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_pet_lunjian_person_sign_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_pet_lunjian_person_sign`
--

LOCK TABLES `xq_ac_pet_lunjian_person_sign` WRITE;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian_person_sign` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian_person_sign` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_pet_lunjian_sign`
--

DROP TABLE IF EXISTS `xq_ac_pet_lunjian_sign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_pet_lunjian_sign` (
  `fail_times` bigint DEFAULT NULL,
  `jf` bigint DEFAULT NULL,
  `members` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_pet_lunjian_sign_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_pet_lunjian_sign`
--

LOCK TABLES `xq_ac_pet_lunjian_sign` WRITE;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian_sign` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_pet_lunjian_sign` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_ac_pk_jj_view`
--

DROP TABLE IF EXISTS `xq_ac_pk_jj_view`;
/*!50001 DROP VIEW IF EXISTS `xq_ac_pk_jj_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_ac_pk_jj_view` AS SELECT 
 1 AS `name`,
 1 AS `jd`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_ac_pk_log`
--

DROP TABLE IF EXISTS `xq_ac_pk_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_pk_log` (
  `jingji` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `paiwei` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_pk_log_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_pk_log`
--

LOCK TABLES `xq_ac_pk_log` WRITE;
/*!40000 ALTER TABLE `xq_ac_pk_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_pk_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_ac_pk_pw_view`
--

DROP TABLE IF EXISTS `xq_ac_pk_pw_view`;
/*!50001 DROP VIEW IF EXISTS `xq_ac_pk_pw_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_ac_pk_pw_view` AS SELECT 
 1 AS `name`,
 1 AS `jd`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_ac_public_task`
--

DROP TABLE IF EXISTS `xq_ac_public_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_public_task` (
  `end_time` bigint DEFAULT NULL,
  `gainner` longtext,
  `id` bigint DEFAULT NULL,
  `k` varchar(512) DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  `start_time` bigint DEFAULT NULL,
  `status` bigint DEFAULT NULL,
  KEY `idx_xq_ac_public_task_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_public_task`
--

LOCK TABLES `xq_ac_public_task` WRITE;
/*!40000 ALTER TABLE `xq_ac_public_task` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_public_task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_public_task_player`
--

DROP TABLE IF EXISTS `xq_ac_public_task_player`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_public_task_player` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `rewards` longtext,
  KEY `idx_xq_ac_public_task_player_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_public_task_player`
--

LOCK TABLES `xq_ac_public_task_player` WRITE;
/*!40000 ALTER TABLE `xq_ac_public_task_player` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_public_task_player` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_qd_gain_shen`
--

DROP TABLE IF EXISTS `xq_ac_qd_gain_shen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_qd_gain_shen` (
  `gain_shen` bigint DEFAULT NULL,
  `gain_tong` bigint DEFAULT NULL,
  `gain_yuanbao` bigint DEFAULT NULL,
  `is_shen_gd` bigint DEFAULT NULL,
  `is_tong_gd` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `shen_jf` bigint DEFAULT NULL,
  `tong_jf` bigint DEFAULT NULL,
  KEY `idx_xq_ac_qd_gain_shen_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_qd_gain_shen`
--

LOCK TABLES `xq_ac_qd_gain_shen` WRITE;
/*!40000 ALTER TABLE `xq_ac_qd_gain_shen` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_qd_gain_shen` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_qiandao`
--

DROP TABLE IF EXISTS `xq_ac_qiandao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_qiandao` (
  `gain0` longtext,
  `name` varchar(512) DEFAULT NULL,
  `unlock0` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_qiandao_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_qiandao`
--

LOCK TABLES `xq_ac_qiandao` WRITE;
/*!40000 ALTER TABLE `xq_ac_qiandao` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_qiandao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_reward`
--

DROP TABLE IF EXISTS `xq_ac_reward`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_reward` (
  `name` varchar(512) DEFAULT NULL,
  `surplus` bigint DEFAULT NULL,
  KEY `idx_xq_ac_reward_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_reward`
--

LOCK TABLES `xq_ac_reward` WRITE;
/*!40000 ALTER TABLE `xq_ac_reward` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_reward` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_shenfu`
--

DROP TABLE IF EXISTS `xq_ac_shenfu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_shenfu` (
  `end` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `sf_key` bigint DEFAULT NULL,
  KEY `idx_xq_ac_shenfu_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_shenfu`
--

LOCK TABLES `xq_ac_shenfu` WRITE;
/*!40000 ALTER TABLE `xq_ac_shenfu` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_shenfu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_sjjl`
--

DROP TABLE IF EXISTS `xq_ac_sjjl`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_sjjl` (
  `cqrewards` longtext,
  `exchange` longtext,
  `libao` longtext,
  `name` varchar(512) DEFAULT NULL,
  `qiandao` longtext,
  `times` bigint DEFAULT NULL,
  `tuangou` longtext,
  `xfrewards` longtext,
  `ybrewards` longtext,
  KEY `idx_xq_ac_sjjl_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_sjjl`
--

LOCK TABLES `xq_ac_sjjl` WRITE;
/*!40000 ALTER TABLE `xq_ac_sjjl` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_sjjl` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_sjjl_xf_lj`
--

DROP TABLE IF EXISTS `xq_ac_sjjl_xf_lj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_sjjl_xf_lj` (
  `name` varchar(512) DEFAULT NULL,
  `yb` bigint DEFAULT NULL,
  KEY `idx_xq_ac_sjjl_xf_lj_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_sjjl_xf_lj`
--

LOCK TABLES `xq_ac_sjjl_xf_lj` WRITE;
/*!40000 ALTER TABLE `xq_ac_sjjl_xf_lj` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_sjjl_xf_lj` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_st_sign`
--

DROP TABLE IF EXISTS `xq_ac_st_sign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_st_sign` (
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_st_sign_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_st_sign`
--

LOCK TABLES `xq_ac_st_sign` WRITE;
/*!40000 ALTER TABLE `xq_ac_st_sign` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_st_sign` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_ac_st_sign_view`
--

DROP TABLE IF EXISTS `xq_ac_st_sign_view`;
/*!50001 DROP VIEW IF EXISTS `xq_ac_st_sign_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_ac_st_sign_view` AS SELECT 
 1 AS `name`,
 1 AS `lever`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_ac_tianbing`
--

DROP TABLE IF EXISTS `xq_ac_tianbing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_tianbing` (
  `lv` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_tianbing_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_tianbing`
--

LOCK TABLES `xq_ac_tianbing` WRITE;
/*!40000 ALTER TABLE `xq_ac_tianbing` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_tianbing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_tianti`
--

DROP TABLE IF EXISTS `xq_ac_tianti`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_tianti` (
  `name` varchar(512) DEFAULT NULL,
  `ts` bigint DEFAULT NULL,
  KEY `idx_xq_ac_tianti_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_tianti`
--

LOCK TABLES `xq_ac_tianti` WRITE;
/*!40000 ALTER TABLE `xq_ac_tianti` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_tianti` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_ac_tianti_view`
--

DROP TABLE IF EXISTS `xq_ac_tianti_view`;
/*!50001 DROP VIEW IF EXISTS `xq_ac_tianti_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_ac_tianti_view` AS SELECT 
 1 AS `name`,
 1 AS `ts`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_ac_tongji`
--

DROP TABLE IF EXISTS `xq_ac_tongji`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_tongji` (
  `created` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `tj_name` longtext,
  KEY `idx_xq_ac_tongji_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_tongji`
--

LOCK TABLES `xq_ac_tongji` WRITE;
/*!40000 ALTER TABLE `xq_ac_tongji` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_tongji` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_tuangou_rewards`
--

DROP TABLE IF EXISTS `xq_ac_tuangou_rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_tuangou_rewards` (
  `id` bigint DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_tuangou_rewards_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_tuangou_rewards`
--

LOCK TABLES `xq_ac_tuangou_rewards` WRITE;
/*!40000 ALTER TABLE `xq_ac_tuangou_rewards` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_tuangou_rewards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_tuangou_rewards_gain`
--

DROP TABLE IF EXISTS `xq_ac_tuangou_rewards_gain`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_tuangou_rewards_gain` (
  `a1` varchar(512) DEFAULT NULL,
  `a2` varchar(512) DEFAULT NULL,
  `a3` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_tuangou_rewards_gain_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_tuangou_rewards_gain`
--

LOCK TABLES `xq_ac_tuangou_rewards_gain` WRITE;
/*!40000 ALTER TABLE `xq_ac_tuangou_rewards_gain` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_tuangou_rewards_gain` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_vip_gift`
--

DROP TABLE IF EXISTS `xq_ac_vip_gift`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_vip_gift` (
  `g1` varchar(512) DEFAULT NULL,
  `g10` varchar(512) DEFAULT NULL,
  `g2` varchar(512) DEFAULT NULL,
  `g3` varchar(512) DEFAULT NULL,
  `g4` varchar(512) DEFAULT NULL,
  `g5` varchar(512) DEFAULT NULL,
  `g6` varchar(512) DEFAULT NULL,
  `g7` varchar(512) DEFAULT NULL,
  `g8` varchar(512) DEFAULT NULL,
  `g9` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_vip_gift_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_vip_gift`
--

LOCK TABLES `xq_ac_vip_gift` WRITE;
/*!40000 ALTER TABLE `xq_ac_vip_gift` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_vip_gift` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_whjx`
--

DROP TABLE IF EXISTS `xq_ac_whjx`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_whjx` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_whjx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_whjx`
--

LOCK TABLES `xq_ac_whjx` WRITE;
/*!40000 ALTER TABLE `xq_ac_whjx` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_whjx` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_wzyc`
--

DROP TABLE IF EXISTS `xq_ac_wzyc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_wzyc` (
  `cbt_key` bigint DEFAULT NULL,
  `free_sx_times` bigint DEFAULT NULL,
  `gain_times` longtext,
  `lv` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `sx_times` bigint DEFAULT NULL,
  `type` bigint DEFAULT NULL,
  KEY `idx_xq_ac_wzyc_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_wzyc`
--

LOCK TABLES `xq_ac_wzyc` WRITE;
/*!40000 ALTER TABLE `xq_ac_wzyc` DISABLE KEYS */;
INSERT INTO `xq_ac_wzyc` VALUES (NULL,1,'3',1,'q',0,0);
/*!40000 ALTER TABLE `xq_ac_wzyc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_xinmo`
--

DROP TABLE IF EXISTS `xq_ac_xinmo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_xinmo` (
  `lv` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_xinmo_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_xinmo`
--

LOCK TABLES `xq_ac_xinmo` WRITE;
/*!40000 ALTER TABLE `xq_ac_xinmo` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_xinmo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_xxzd`
--

DROP TABLE IF EXISTS `xq_ac_xxzd`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_xxzd` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_xxzd_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_xxzd`
--

LOCK TABLES `xq_ac_xxzd` WRITE;
/*!40000 ALTER TABLE `xq_ac_xxzd` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_xxzd` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_ygmb`
--

DROP TABLE IF EXISTS `xq_ac_ygmb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_ygmb` (
  `name` varchar(512) DEFAULT NULL,
  `r1` longtext,
  `r2` longtext,
  `r3` longtext,
  KEY `idx_xq_ac_ygmb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_ygmb`
--

LOCK TABLES `xq_ac_ygmb` WRITE;
/*!40000 ALTER TABLE `xq_ac_ygmb` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_ygmb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_yhmk`
--

DROP TABLE IF EXISTS `xq_ac_yhmk`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_yhmk` (
  `gain` longtext,
  `lv1` bigint DEFAULT NULL,
  `lv2` bigint DEFAULT NULL,
  `lv3` bigint DEFAULT NULL,
  `lv4` bigint DEFAULT NULL,
  `lv5` bigint DEFAULT NULL,
  `lv6` bigint DEFAULT NULL,
  `lv7` bigint DEFAULT NULL,
  `myd1` varchar(512) DEFAULT NULL,
  `myd2` varchar(512) DEFAULT NULL,
  `myd3` varchar(512) DEFAULT NULL,
  `myd4` varchar(512) DEFAULT NULL,
  `myd5` varchar(512) DEFAULT NULL,
  `myd6` varchar(512) DEFAULT NULL,
  `myd7` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `qiaoda` varchar(512) DEFAULT NULL,
  KEY `idx_xq_ac_yhmk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_yhmk`
--

LOCK TABLES `xq_ac_yhmk` WRITE;
/*!40000 ALTER TABLE `xq_ac_yhmk` DISABLE KEYS */;
INSERT INTO `xq_ac_yhmk` VALUES ('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','q','0'),('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','cs','0'),('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','1111','0'),('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','中崔','0'),('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','宝宝BUS','0'),('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','氪金老母猪','0'),('0',0,0,0,0,0,0,0,'0','0','0','0','0','0','0','你是个鸡扒','0');
/*!40000 ALTER TABLE `xq_ac_yhmk` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_zjcm`
--

DROP TABLE IF EXISTS `xq_ac_zjcm`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_zjcm` (
  `map_key` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_ac_zjcm_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_zjcm`
--

LOCK TABLES `xq_ac_zjcm` WRITE;
/*!40000 ALTER TABLE `xq_ac_zjcm` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_zjcm` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_ac_zsl`
--

DROP TABLE IF EXISTS `xq_ac_zsl`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_ac_zsl` (
  `created` varchar(512) DEFAULT NULL,
  `destroy` longtext,
  `getter` longtext,
  `id` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `player` longtext,
  `price` bigint DEFAULT NULL,
  `price_type` bigint DEFAULT NULL,
  KEY `idx_xq_ac_zsl_id` (`id`),
  KEY `idx_xq_ac_zsl_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_ac_zsl`
--

LOCK TABLES `xq_ac_zsl` WRITE;
/*!40000 ALTER TABLE `xq_ac_zsl` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_ac_zsl` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_cb`
--

DROP TABLE IF EXISTS `xq_activity_cb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_cb` (
  `isget` varchar(512) DEFAULT NULL,
  `lv` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `qbtimes` bigint DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  `uptimes` bigint DEFAULT NULL,
  KEY `idx_xq_activity_cb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_cb`
--

LOCK TABLES `xq_activity_cb` WRITE;
/*!40000 ALTER TABLE `xq_activity_cb` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_activity_cb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_chumo`
--

DROP TABLE IF EXISTS `xq_activity_chumo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_chumo` (
  `id` bigint DEFAULT NULL,
  KEY `idx_xq_activity_chumo_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_chumo`
--

LOCK TABLES `xq_activity_chumo` WRITE;
/*!40000 ALTER TABLE `xq_activity_chumo` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_activity_chumo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_fb`
--

DROP TABLE IF EXISTS `xq_activity_fb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_fb` (
  `fb100` varchar(512) DEFAULT NULL,
  `fb50` varchar(512) DEFAULT NULL,
  `fb60` varchar(512) DEFAULT NULL,
  `fb70` varchar(512) DEFAULT NULL,
  `fb80` varchar(512) DEFAULT NULL,
  `fb90` varchar(512) DEFAULT NULL,
  `fbhh` varchar(512) DEFAULT NULL,
  `fbls` varchar(512) DEFAULT NULL,
  `fbys` varchar(512) DEFAULT NULL,
  `fbyzj` varchar(512) DEFAULT NULL,
  `fbzx` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_activity_fb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_fb`
--

LOCK TABLES `xq_activity_fb` WRITE;
/*!40000 ALTER TABLE `xq_activity_fb` DISABLE KEYS */;
INSERT INTO `xq_activity_fb` VALUES ('3','3','3','3','3','3','2','2','2','1',2,'q'),('3','3','3','3','3','3','2','2','2','1',2,'cs'),('3','3','3','3','3','3','2','2','2','1',2,'1111'),('3','3','3','3','3','3','2','2','2','1',2,'中崔'),('3','3','3','3','3','3','2','2','2','1',2,'宝宝BUS'),('3','3','3','3','3','3','2','2','2','1',2,'氪金老母猪'),('3','3','3','3','3','3','2','2','2','1',2,'你是个鸡扒');
/*!40000 ALTER TABLE `xq_activity_fb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_happy_answer`
--

DROP TABLE IF EXISTS `xq_activity_happy_answer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_happy_answer` (
  `name` varchar(512) DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  `right_num` bigint DEFAULT NULL,
  KEY `idx_xq_activity_happy_answer_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_happy_answer`
--

LOCK TABLES `xq_activity_happy_answer` WRITE;
/*!40000 ALTER TABLE `xq_activity_happy_answer` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_activity_happy_answer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_wb`
--

DROP TABLE IF EXISTS `xq_activity_wb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_wb` (
  `finish` bigint DEFAULT NULL,
  `lv` bigint DEFAULT NULL,
  `map` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `pos` bigint DEFAULT NULL,
  `times` bigint DEFAULT NULL,
  KEY `idx_xq_activity_wb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_wb`
--

LOCK TABLES `xq_activity_wb` WRITE;
/*!40000 ALTER TABLE `xq_activity_wb` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_activity_wb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_zhuanpan`
--

DROP TABLE IF EXISTS `xq_activity_zhuanpan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_zhuanpan` (
  `name` varchar(512) DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  KEY `idx_xq_activity_zhuanpan_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_zhuanpan`
--

LOCK TABLES `xq_activity_zhuanpan` WRITE;
/*!40000 ALTER TABLE `xq_activity_zhuanpan` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_activity_zhuanpan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_activity_zm_answer`
--

DROP TABLE IF EXISTS `xq_activity_zm_answer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_activity_zm_answer` (
  `ans` longtext,
  `name` varchar(512) DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  `progress` varchar(512) DEFAULT NULL,
  `right_num` bigint DEFAULT NULL,
  KEY `idx_xq_activity_zm_answer_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_activity_zm_answer`
--

LOCK TABLES `xq_activity_zm_answer` WRITE;
/*!40000 ALTER TABLE `xq_activity_zm_answer` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_activity_zm_answer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_chat`
--

DROP TABLE IF EXISTS `xq_chat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_chat` (
  `content` longtext,
  `created` varchar(512) DEFAULT NULL,
  `id` bigint DEFAULT NULL,
  `receiver` longtext,
  `sender` longtext,
  `type` bigint DEFAULT NULL,
  KEY `idx_xq_chat_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_chat`
--

LOCK TABLES `xq_chat` WRITE;
/*!40000 ALTER TABLE `xq_chat` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_chat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_dsx_sign`
--

DROP TABLE IF EXISTS `xq_dsx_sign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_dsx_sign` (
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `win` bigint DEFAULT NULL,
  KEY `idx_xq_dsx_sign_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_dsx_sign`
--

LOCK TABLES `xq_dsx_sign` WRITE;
/*!40000 ALTER TABLE `xq_dsx_sign` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_dsx_sign` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_friend`
--

DROP TABLE IF EXISTS `xq_friend`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_friend` (
  `friend` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_friend_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_friend`
--

LOCK TABLES `xq_friend` WRITE;
/*!40000 ALTER TABLE `xq_friend` DISABLE KEYS */;
INSERT INTO `xq_friend` VALUES ('[]','q'),('[]','cs'),('[]','1111'),('[]','中崔'),('[]','宝宝BUS'),('[]','氪金老母猪'),('[]','你是个鸡扒');
/*!40000 ALTER TABLE `xq_friend` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs`
--

DROP TABLE IF EXISTS `xq_gangs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs` (
  `bg` bigint DEFAULT NULL,
  `captain` longtext,
  `id` bigint DEFAULT NULL,
  `lever` bigint DEFAULT NULL,
  `members` longtext,
  `money` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `notice` longtext,
  KEY `idx_xq_gangs_id` (`id`),
  KEY `idx_xq_gangs_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs`
--

LOCK TABLES `xq_gangs` WRITE;
/*!40000 ALTER TABLE `xq_gangs` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_ac_times`
--

DROP TABLE IF EXISTS `xq_gangs_ac_times`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_ac_times` (
  `bosstimes` bigint DEFAULT NULL,
  `dayreward` longtext,
  `name` varchar(512) DEFAULT NULL,
  `pstimes` bigint DEFAULT NULL,
  `yhtimes` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_ac_times_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_ac_times`
--

LOCK TABLES `xq_gangs_ac_times` WRITE;
/*!40000 ALTER TABLE `xq_gangs_ac_times` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_ac_times` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_activity`
--

DROP TABLE IF EXISTS `xq_gangs_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_activity` (
  `boss` longtext,
  `id` bigint DEFAULT NULL,
  `ps` varchar(512) DEFAULT NULL,
  `yh` bigint DEFAULT NULL,
  `ywt` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_activity_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_activity`
--

LOCK TABLES `xq_gangs_activity` WRITE;
/*!40000 ALTER TABLE `xq_gangs_activity` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_boss`
--

DROP TABLE IF EXISTS `xq_gangs_boss`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_boss` (
  `id` bigint DEFAULT NULL,
  `rewards` longtext,
  `xue` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_boss_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_boss`
--

LOCK TABLES `xq_gangs_boss` WRITE;
/*!40000 ALTER TABLE `xq_gangs_boss` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_boss` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_build`
--

DROP TABLE IF EXISTS `xq_gangs_build`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_build` (
  `book` longtext,
  `id` bigint DEFAULT NULL,
  `mifa` longtext,
  `shop` longtext,
  `solicit` longtext,
  `tec` longtext,
  KEY `idx_xq_gangs_build_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_build`
--

LOCK TABLES `xq_gangs_build` WRITE;
/*!40000 ALTER TABLE `xq_gangs_build` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_build` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_bz_rewards_exchange`
--

DROP TABLE IF EXISTS `xq_gangs_bz_rewards_exchange`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_bz_rewards_exchange` (
  `exchange` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_gangs_bz_rewards_exchange_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_bz_rewards_exchange`
--

LOCK TABLES `xq_gangs_bz_rewards_exchange` WRITE;
/*!40000 ALTER TABLE `xq_gangs_bz_rewards_exchange` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_bz_rewards_exchange` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_farm`
--

DROP TABLE IF EXISTS `xq_gangs_farm`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_farm` (
  `id` bigint DEFAULT NULL,
  `yt1` bigint DEFAULT NULL,
  `yt2` bigint DEFAULT NULL,
  `yt3` bigint DEFAULT NULL,
  `yt4` bigint DEFAULT NULL,
  `yt5` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_farm_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_farm`
--

LOCK TABLES `xq_gangs_farm` WRITE;
/*!40000 ALTER TABLE `xq_gangs_farm` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_farm` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_fight`
--

DROP TABLE IF EXISTS `xq_gangs_fight`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_fight` (
  `id` bigint DEFAULT NULL,
  `jf` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_fight_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_fight`
--

LOCK TABLES `xq_gangs_fight` WRITE;
/*!40000 ALTER TABLE `xq_gangs_fight` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_fight` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_members`
--

DROP TABLE IF EXISTS `xq_gangs_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_members` (
  `bg` bigint DEFAULT NULL,
  `bpid` bigint DEFAULT NULL,
  `daybg` bigint DEFAULT NULL,
  `job` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `tasktimes` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_members_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_members`
--

LOCK TABLES `xq_gangs_members` WRITE;
/*!40000 ALTER TABLE `xq_gangs_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_ps`
--

DROP TABLE IF EXISTS `xq_gangs_ps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_ps` (
  `goods` longtext,
  `name` varchar(512) DEFAULT NULL,
  `tale` longtext,
  KEY `idx_xq_gangs_ps_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_ps`
--

LOCK TABLES `xq_gangs_ps` WRITE;
/*!40000 ALTER TABLE `xq_gangs_ps` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_ps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_req`
--

DROP TABLE IF EXISTS `xq_gangs_req`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_req` (
  `id` bigint DEFAULT NULL,
  `req` longtext,
  KEY `idx_xq_gangs_req_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_req`
--

LOCK TABLES `xq_gangs_req` WRITE;
/*!40000 ALTER TABLE `xq_gangs_req` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_req` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_robber`
--

DROP TABLE IF EXISTS `xq_gangs_robber`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_robber` (
  `id` bigint DEFAULT NULL,
  `num` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_robber_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_robber`
--

LOCK TABLES `xq_gangs_robber` WRITE;
/*!40000 ALTER TABLE `xq_gangs_robber` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_robber` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_task`
--

DROP TABLE IF EXISTS `xq_gangs_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_task` (
  `id` bigint DEFAULT NULL,
  `task` longtext,
  KEY `idx_xq_gangs_task_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_task`
--

LOCK TABLES `xq_gangs_task` WRITE;
/*!40000 ALTER TABLE `xq_gangs_task` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_v`
--

DROP TABLE IF EXISTS `xq_gangs_v`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_v` (
  `id` bigint DEFAULT NULL,
  `monkey` longtext,
  `pstimes` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_v_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_v`
--

LOCK TABLES `xq_gangs_v` WRITE;
/*!40000 ALTER TABLE `xq_gangs_v` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_v` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_gangs_yanhui`
--

DROP TABLE IF EXISTS `xq_gangs_yanhui`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_gangs_yanhui` (
  `id` bigint DEFAULT NULL,
  `members` longtext,
  `num` bigint DEFAULT NULL,
  KEY `idx_xq_gangs_yanhui_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_gangs_yanhui`
--

LOCK TABLES `xq_gangs_yanhui` WRITE;
/*!40000 ALTER TABLE `xq_gangs_yanhui` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_gangs_yanhui` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_grounding_goods`
--

DROP TABLE IF EXISTS `xq_grounding_goods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_grounding_goods` (
  `list` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_grounding_goods_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_grounding_goods`
--

LOCK TABLES `xq_grounding_goods` WRITE;
/*!40000 ALTER TABLE `xq_grounding_goods` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_grounding_goods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_grounding_goods_view`
--

DROP TABLE IF EXISTS `xq_grounding_goods_view`;
/*!50001 DROP VIEW IF EXISTS `xq_grounding_goods_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_grounding_goods_view` AS SELECT 
 1 AS `list`,
 1 AS `name`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_invest_log`
--

DROP TABLE IF EXISTS `xq_invest_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_invest_log` (
  `addgoldsum` bigint DEFAULT NULL,
  `created` varchar(512) DEFAULT NULL,
  `cutgoldsum` bigint DEFAULT NULL,
  `id` bigint DEFAULT NULL,
  `item` varchar(512) DEFAULT NULL,
  `type` bigint DEFAULT NULL,
  KEY `idx_xq_invest_log_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_invest_log`
--

LOCK TABLES `xq_invest_log` WRITE;
/*!40000 ALTER TABLE `xq_invest_log` DISABLE KEYS */;
INSERT INTO `xq_invest_log` VALUES (0,'1786720163052',0,1786720163052685,'1',1),(0,'1786720163356',0,1786720163356792,'1',0),(0,'1786720763058',0,1786720763058695,'2',1),(0,'1786720765179',0,1786720765179322,'2',0),(0,'1786721363061',0,1786721363061838,'3',1),(0,'1786721365194',0,1786721365194144,'3',0),(0,'1786734173460',0,1786734173460362,'1',1),(0,'1786734173470',0,1786734173470509,'1',0),(0,'1786734775459',0,1786734775459153,'2',1),(0,'1786734775464',0,1786734775464251,'2',0),(0,'1786735377459',0,1786735377459453,'3',1),(0,'1786735377465',0,1786735377465561,'3',0),(0,'1786735979459',0,1786735979459933,'4',1),(0,'1786735979463',0,1786735979463680,'4',0),(0,'1786736579459',0,1786736579459099,'5',1),(0,'1786736579464',0,1786736579464647,'5',0),(0,'1786737457141',0,1786737457141456,'1',1),(0,'1786737457174',0,1786737457174198,'1',0),(0,'1786738057140',0,1786738057140023,'2',1),(0,'1786738059142',0,1786738059142169,'2',0),(0,'1786738964243',0,1786738964243193,'1',1),(0,'1786738964274',0,1786738964274597,'1',0),(0,'1786740536877',0,1786740536877138,'1',1),(0,'1786740536908',0,1786740536908876,'1',0);
/*!40000 ALTER TABLE `xq_invest_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_log_online`
--

DROP TABLE IF EXISTS `xq_log_online`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_log_online` (
  `accumulate` bigint DEFAULT NULL,
  `is_get_lld` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `offline` bigint DEFAULT NULL,
  `online` bigint DEFAULT NULL,
  KEY `idx_xq_log_online_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_log_online`
--

LOCK TABLES `xq_log_online` WRITE;
/*!40000 ALTER TABLE `xq_log_online` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_log_online` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_lv_prop_view`
--

DROP TABLE IF EXISTS `xq_lv_prop_view`;
/*!50001 DROP VIEW IF EXISTS `xq_lv_prop_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_lv_prop_view` AS SELECT 
 1 AS `name`,
 1 AS `lever`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_email`
--

DROP TABLE IF EXISTS `xq_man_email`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_email` (
  `email` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_email_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_email`
--

LOCK TABLES `xq_man_email` WRITE;
/*!40000 ALTER TABLE `xq_man_email` DISABLE KEYS */;
INSERT INTO `xq_man_email` VALUES ('[]','q'),('[]','cs'),('[]','1111'),('[]','中崔'),('[]','宝宝BUS'),('[]','氪金老母猪'),('[]','你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_email` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_email_back`
--

DROP TABLE IF EXISTS `xq_man_email_back`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_email_back` (
  `email_id` bigint DEFAULT NULL,
  `email_receiver` longtext,
  `id` bigint DEFAULT NULL,
  KEY `idx_xq_man_email_back_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_email_back`
--

LOCK TABLES `xq_man_email_back` WRITE;
/*!40000 ALTER TABLE `xq_man_email_back` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_man_email_back` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_equip`
--

DROP TABLE IF EXISTS `xq_man_equip`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_equip` (
  `equip` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_equip_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_equip`
--

LOCK TABLES `xq_man_equip` WRITE;
/*!40000 ALTER TABLE `xq_man_equip` DISABLE KEYS */;
INSERT INTO `xq_man_equip` VALUES ('{\"wq\":\"\",\"jb\":\"\",\"sz\":\"\",\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":{\"key\":\"100110060001\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786720614562366\",\"capacity\":{\"num\":150000}}}','q'),('{\"wq\":\"\",\"jb\":\"\",\"sz\":\"\",\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":\"\"}','cs'),('{\"wq\":\"\",\"jb\":\"\",\"sz\":\"\",\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":\"\"}','1111'),('{\"wq\":\"\",\"jb\":\"\",\"sz\":{\"key\":\"100110010420\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734799283756\",\"randomAttr\":[],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":{\"key\":\"100110060001\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734123274633\",\"capacity\":{\"num\":150000}}}','中崔'),('{\"wq\":\"\",\"jb\":\"\",\"sz\":{\"key\":\"100110010420\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734897258533\",\"randomAttr\":[],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":{\"key\":\"100110060001\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734211004119\",\"capacity\":{\"num\":150000}}}','宝宝BUS'),('{\"wq\":\"\",\"jb\":\"\",\"sz\":\"\",\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":\"\"}','氪金老母猪'),('{\"wq\":\"\",\"jb\":\"\",\"sz\":\"\",\"wb\":\"\",\"tb\":\"\",\"xb\":\"\",\"yb\":\"\",\"tuib\":\"\",\"jiaob\":\"\",\"hf\":\"\",\"fb\":\"\",\"gf\":\"\",\"bjb\":\"\"}','你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_equip` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_man_equip_view`
--

DROP TABLE IF EXISTS `xq_man_equip_view`;
/*!50001 DROP VIEW IF EXISTS `xq_man_equip_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_man_equip_view` AS SELECT 
 1 AS `equip`,
 1 AS `name`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_formation`
--

DROP TABLE IF EXISTS `xq_man_formation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_formation` (
  `formation` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_formation_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_formation`
--

LOCK TABLES `xq_man_formation` WRITE;
/*!40000 ALTER TABLE `xq_man_formation` DISABLE KEYS */;
INSERT INTO `xq_man_formation` VALUES ('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t1\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":{\"type\":1,\"key\":\"1001\"},\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','q'),('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t1\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":\"\",\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','cs'),('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t1\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":\"\",\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','1111'),('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t2\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":{\"type\":1,\"key\":\"1000\"},\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','中崔'),('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t1\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":{\"type\":1,\"key\":\"1000\"},\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','宝宝BUS'),('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t1\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":\"\",\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','氪金老母猪'),('{\"p0\":{\"type\":0,\"key\":\"xs_nan_t2\"},\"p1\":\"\",\"p2\":\"\",\"p3\":\"\",\"p4\":\"\",\"p5\":\"\",\"p6\":\"\",\"p7\":\"\",\"p8\":\"\",\"p9\":\"\",\"p10\":\"\",\"p11\":\"\",\"p12\":\"\",\"p13\":\"\",\"p14\":\"\",\"p15\":\"\",\"p16\":\"\",\"p17\":\"\",\"p18\":\"\",\"p19\":\"\"}','你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_formation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_huoban`
--

DROP TABLE IF EXISTS `xq_man_huoban`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_huoban` (
  `huoban` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_huoban_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_huoban`
--

LOCK TABLES `xq_man_huoban` WRITE;
/*!40000 ALTER TABLE `xq_man_huoban` DISABLE KEYS */;
INSERT INTO `xq_man_huoban` VALUES ('[]','q'),('[]','cs'),('[]','1111'),('[]','中崔'),('[]','宝宝BUS'),('[]','氪金老母猪'),('[]','你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_huoban` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_man_huoban_view`
--

DROP TABLE IF EXISTS `xq_man_huoban_view`;
/*!50001 DROP VIEW IF EXISTS `xq_man_huoban_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_man_huoban_view` AS SELECT 
 1 AS `huoban`,
 1 AS `name`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_msg`
--

DROP TABLE IF EXISTS `xq_man_msg`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_msg` (
  `msg` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_msg_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_msg`
--

LOCK TABLES `xq_man_msg` WRITE;
/*!40000 ALTER TABLE `xq_man_msg` DISABLE KEYS */;
INSERT INTO `xq_man_msg` VALUES ('{\"bb\":0,\"bg\":0,\"bp\":\"\",\"ch\":\"\",\"jf\":0,\"yp\":610,\"sez\":5,\"wxz\":0,\"xld\":0,\"cbjf\":0,\"gold\":1000000,\"ldjf\":0,\"stu1\":\"\",\"stu2\":\"\",\"stu3\":\"\",\"swdj\":{\"lv\":0,\"exp\":0},\"tale\":26,\"xrmf\":{\"xfLv\":0,\"xrLv\":0},\"wings\":\"\",\"jmPoint\":0,\"jungong\":0,\"realmLv\":0,\"teacher\":\"\"}','q'),('{\"bb\": 0, \"bg\": 0, \"bp\": \"\", \"ch\": \"\", \"jf\": 0, \"yp\": 283, \"sez\": 5, \"wxz\": 0, \"xld\": 0, \"cbjf\": 0, \"gold\": 1000000, \"ldjf\": 0, \"stu1\": \"\", \"stu2\": \"\", \"stu3\": \"\", \"swdj\": {\"lv\": 0, \"exp\": 0}, \"tale\": 12, \"xrmf\": {\"xfLv\": 0, \"xrLv\": 0}, \"wings\": \"\", \"jmPoint\": 0, \"jungong\": 0, \"realmLv\": 0, \"teacher\": \"\"}','cs'),('{\"bb\":0,\"bg\":0,\"bp\":\"\",\"ch\":\"\",\"jf\":0,\"yp\":313,\"sez\":5,\"wxz\":0,\"xld\":0,\"cbjf\":0,\"gold\":697300,\"ldjf\":0,\"stu1\":\"\",\"stu2\":\"\",\"stu3\":\"\",\"swdj\":{\"lv\":0,\"exp\":0},\"tale\":12,\"xrmf\":{\"xfLv\":0,\"xrLv\":0},\"wings\":\"\",\"jmPoint\":0,\"jungong\":0,\"realmLv\":0,\"teacher\":\"\"}','1111'),('{\"bb\":0,\"bg\":0,\"bp\":\"\",\"ch\":\"\",\"jf\":0,\"yp\":3295,\"sez\":5,\"wxz\":0,\"xld\":0,\"cbjf\":0,\"gold\":868000,\"ldjf\":0,\"stu1\":\"\",\"stu2\":\"\",\"stu3\":\"\",\"swdj\":{\"lv\":0,\"exp\":0},\"tale\":210,\"xrmf\":{\"xfLv\":0,\"xrLv\":0},\"wings\":\"\",\"jmPoint\":0,\"jungong\":0,\"realmLv\":0,\"teacher\":\"\"}','中崔'),('{\"bb\":0,\"bg\":0,\"bp\":\"\",\"ch\":\"\",\"jf\":0,\"yp\":3671,\"sez\":5,\"wxz\":0,\"xld\":0,\"cbjf\":0,\"gold\":269690,\"ldjf\":0,\"stu1\":\"\",\"stu2\":\"\",\"stu3\":\"\",\"swdj\":{\"lv\":0,\"exp\":0},\"tale\":152,\"xrmf\":{\"xfLv\":0,\"xrLv\":0},\"wings\":\"\",\"jmPoint\":0,\"jungong\":0,\"realmLv\":0,\"teacher\":\"\"}','宝宝BUS'),('{\"bb\":0,\"bg\":0,\"bp\":\"\",\"ch\":\"\",\"jf\":0,\"yp\":10,\"sez\":5,\"wxz\":0,\"xld\":0,\"cbjf\":0,\"gold\":900000,\"ldjf\":0,\"stu1\":\"\",\"stu2\":\"\",\"stu3\":\"\",\"swdj\":{\"lv\":0,\"exp\":0},\"tale\":0,\"xrmf\":{\"xfLv\":0,\"xrLv\":0},\"wings\":\"\",\"jmPoint\":0,\"jungong\":0,\"realmLv\":0,\"teacher\":\"\"}','氪金老母猪'),('{\"bb\":0,\"bg\":0,\"bp\":\"\",\"ch\":\"\",\"jf\":0,\"yp\":283,\"sez\":5,\"wxz\":0,\"xld\":0,\"cbjf\":0,\"gold\":1000000,\"ldjf\":0,\"stu1\":\"\",\"stu2\":\"\",\"stu3\":\"\",\"swdj\":{\"lv\":0,\"exp\":0},\"tale\":12,\"xrmf\":{\"xfLv\":0,\"xrLv\":0},\"wings\":\"\",\"jmPoint\":0,\"jungong\":0,\"realmLv\":0,\"teacher\":\"\"}','你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_msg` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_package`
--

DROP TABLE IF EXISTS `xq_man_package`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_package` (
  `bbn` varchar(512) DEFAULT NULL,
  `ckn` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `package` longtext,
  `tale` longtext,
  KEY `idx_xq_man_package_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_package`
--

LOCK TABLES `xq_man_package` WRITE;
/*!40000 ALTER TABLE `xq_man_package` DISABLE KEYS */;
INSERT INTO `xq_man_package` VALUES ('150','40','q','[{\"key\":\"10000233\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786720614510903\"}]','0'),('150','40','cs','[{\"key\":\"10000233\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786733942863514\"},{\"key\":\"100110060001\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786733942864203\",\"capacity\":{\"num\":150000}}]','0'),('150','40','1111','[{\"key\":\"100110060001\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786733893273839\",\"capacity\":{\"num\":150000}},{\"key\":\"10000130\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786734085468786\"},{\"key\":\"10000266\",\"num\":2,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786735292228565\"},{\"key\":\"100210010272\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735299413901\"},{\"key\":\"100210010298\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735301470336\"},{\"key\":\"100210010268\",\"num\":3,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735303535509\"},{\"key\":\"10000209\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786735413705245\"},{\"key\":\"10000123\",\"num\":5,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735450221951\"},{\"key\":\"100210010292\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735518232954\"},{\"key\":\"100210010300\",\"num\":2,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735520866273\"},{\"key\":\"100210010302\",\"num\":2,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735523377545\"},{\"key\":\"100210010299\",\"num\":3,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735525438561\"},{\"key\":\"100210010297\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735534140891\"},{\"key\":\"100210010286\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735536211343\"},{\"key\":\"100210010294\",\"num\":2,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735578932378\"},{\"key\":\"100210010311\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735580916471\"},{\"key\":\"100210010276\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735586608003\"},{\"key\":\"100210010270\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735588632054\"},{\"key\":\"100210010309\",\"num\":2,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735592756762\"},{\"key\":\"100210010284\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735594783107\"},{\"key\":\"100210010277\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735599919952\"}]','0'),('150','40','中崔','[{\"key\":\"100110010480\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734875736337\",\"randomAttr\":[],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},{\"key\":\"100110010663\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734990888614\",\"randomAttr\":[{\"k\":\"js\",\"v\":2}],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},{\"key\":\"10030005\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786735773466992\"},{\"key\":\"10000266\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786735896723704\"},{\"key\":\"100210010312\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735942004179\"},{\"key\":\"100210010282\",\"num\":2,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735946679639\"},{\"key\":\"100210010269\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735951816879\"},{\"key\":\"100210010299\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736015902010\"},{\"key\":\"10000123\",\"num\":95,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736122135319\"}]','0'),('150','40','宝宝BUS','[{\"key\":\"10000104\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786734351465670\"},{\"key\":\"100110010480\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734930399059\",\"randomAttr\":[],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},{\"key\":\"100110010663\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786734945102798\",\"randomAttr\":[{\"k\":\"mj\",\"v\":2}],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},{\"key\":\"10000177\",\"num\":198,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735426599522\"},{\"key\":\"10000178\",\"num\":9,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735442604885\"},{\"key\":\"10030004\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786735629473404\"},{\"key\":\"100110000016\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735707475052\",\"randomAttr\":[],\"forging\":{\"lv\":0},\"inlay\":{\"num\":0,\"list\":[]},\"potential\":{\"num\":0,\"max\":0}},{\"key\":\"10000032\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786735875714381\"},{\"key\":\"10000113\",\"num\":170,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736003793501\"},{\"key\":\"10000261\",\"num\":20,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736070430237\"},{\"key\":\"10000266\",\"num\":2,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786736097266751\"},{\"key\":\"10000261\",\"num\":4,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786736097267545\"},{\"key\":\"10000124\",\"num\":174,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736129336756\"},{\"key\":\"10000123\",\"num\":27,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736417405315\"},{\"key\":\"10000260\",\"num\":19,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736472123336\"}]','0'),('150','40','氪金老母猪','[{\"key\":\"10000266\",\"num\":2,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786736306997654\"},{\"key\":\"10000261\",\"num\":3,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786736306998830\"},{\"key\":\"100210010266\",\"num\":1,\"isBind\":0,\"pos\":0,\"isBad\":0,\"Id\":\"1786736313368763\"}]','0'),('150','40','你是个鸡扒','[{\"key\":\"10000233\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786736261135791\"},{\"key\":\"100110060001\",\"num\":1,\"isBind\":1,\"pos\":0,\"isBad\":0,\"Id\":\"1786736261136392\",\"capacity\":{\"num\":150000}}]','0');
/*!40000 ALTER TABLE `xq_man_package` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_man_package_view`
--

DROP TABLE IF EXISTS `xq_man_package_view`;
/*!50001 DROP VIEW IF EXISTS `xq_man_package_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_man_package_view` AS SELECT 
 1 AS `bbn`,
 1 AS `ckn`,
 1 AS `name`,
 1 AS `package`,
 1 AS `tale`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_pet`
--

DROP TABLE IF EXISTS `xq_man_pet`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_pet` (
  `name` varchar(512) DEFAULT NULL,
  `pet` longtext,
  KEY `idx_xq_man_pet_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_pet`
--

LOCK TABLES `xq_man_pet` WRITE;
/*!40000 ALTER TABLE `xq_man_pet` DISABLE KEYS */;
INSERT INTO `xq_man_pet` VALUES ('q','[{\"key\":\"1001\",\"model\":\"1001\",\"nickName\":\"狼蛛\",\"Id\":\"1786721460890452\",\"loyal\":1000,\"lever\":1,\"eatPet\":0,\"baseProp\":{\"ll\":5,\"zl\":5,\"nl\":5,\"js\":5,\"mj\":5},\"quality\":1,\"savvy\":96,\"grow\":1059,\"qualityValue\":{\"max_xue\":739,\"max_lan\":493,\"wg\":335,\"fg\":786,\"wf\":228,\"ff\":447,\"mz\":247,\"sd\":201,\"css\":292,\"bj\":428},\"attr\":{\"prop\":{\"xue\":523,\"lan\":328,\"exp\":7,\"type\":1},\"skill\":[{\"key\":\"100210010299\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0}]},\"propPoint\":0,\"isFight\":1,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}}]'),('cs','[]'),('1111','[{\"key\":\"1000\",\"model\":\"1000\",\"nickName\":\"赤翼蝠\",\"Id\":\"1786733915876737\",\"loyal\":1000,\"lever\":1,\"eatPet\":0,\"baseProp\":{\"ll\":5,\"zl\":5,\"nl\":5,\"js\":5,\"mj\":5},\"quality\":1,\"savvy\":99,\"grow\":1148,\"qualityValue\":{\"max_xue\":671,\"max_lan\":488,\"wg\":765,\"fg\":362,\"wf\":469,\"ff\":250,\"mz\":407,\"sd\":183,\"css\":270,\"bj\":221},\"attr\":{\"prop\":{\"xue\":521,\"lan\":326,\"exp\":7,\"type\":0},\"skill\":[{\"key\":\"100210010308\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0}]},\"propPoint\":0,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}},{\"key\":\"1221\",\"model\":\"1221\",\"nickName\":\"逆天魔龙\",\"Id\":\"1786735296338469\",\"loyal\":1000,\"lever\":1,\"eatPet\":0,\"baseProp\":{\"ll\":5,\"zl\":5,\"nl\":5,\"js\":5,\"mj\":5},\"quality\":1,\"savvy\":97,\"grow\":1131,\"qualityValue\":{\"max_xue\":2770,\"max_lan\":1693,\"wg\":1818,\"fg\":1708,\"wf\":2443,\"ff\":2250,\"mz\":1521,\"sd\":1087,\"css\":2817,\"bj\":1093},\"attr\":{\"prop\":{\"xue\":588,\"lan\":958,\"exp\":0,\"type\":0},\"skill\":[{\"key\":\"100210010188\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1}]},\"propPoint\":0,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}}]'),('中崔','[{\"key\":\"1216\",\"model\":\"1216\",\"nickName\":\"梦瑶仙子\",\"Id\":\"1786735327043558\",\"loyal\":1000,\"lever\":3,\"eatPet\":0,\"baseProp\":{\"ll\":7,\"zl\":7,\"nl\":7,\"js\":7,\"mj\":7},\"quality\":1,\"savvy\":96,\"grow\":1124,\"qualityValue\":{\"max_xue\":1270,\"max_lan\":2504,\"wg\":1283,\"fg\":2333,\"wf\":1553,\"ff\":1705,\"mz\":880,\"sd\":760,\"css\":1796,\"bj\":1313},\"attr\":{\"prop\":{\"xue\":760,\"lan\":1449,\"exp\":142,\"type\":1},\"skill\":[{\"key\":\"100210010179\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0}]},\"propPoint\":10,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}},{\"key\":\"1221\",\"model\":\"1221\",\"nickName\":\"逆天魔龙\",\"Id\":\"1786735902882933\",\"loyal\":1000,\"lever\":3,\"eatPet\":0,\"baseProp\":{\"ll\":7,\"zl\":7,\"nl\":7,\"js\":7,\"mj\":7},\"quality\":1,\"savvy\":90,\"grow\":1009,\"qualityValue\":{\"max_xue\":2818,\"max_lan\":1775,\"wg\":2185,\"fg\":1759,\"wf\":2558,\"ff\":2378,\"mz\":1318,\"sd\":1242,\"css\":3135,\"bj\":1144},\"attr\":{\"prop\":{\"xue\":891,\"lan\":1059,\"exp\":120,\"type\":0},\"skill\":[{\"key\":\"100210010188\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1,\"key\":\"100210010242\",\"lv\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1}]},\"propPoint\":10,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}}]'),('宝宝BUS','[{\"key\":\"1215\",\"model\":\"1215\",\"nickName\":\"剑圣\",\"Id\":\"1786735472048030\",\"loyal\":1000,\"lever\":1,\"eatPet\":0,\"baseProp\":{\"ll\":5,\"zl\":5,\"nl\":5,\"js\":5,\"mj\":5},\"quality\":1,\"savvy\":96,\"grow\":1038,\"qualityValue\":{\"max_xue\":1619,\"max_lan\":2138,\"wg\":2593,\"fg\":1326,\"wf\":1735,\"ff\":1475,\"mz\":1478,\"sd\":1040,\"css\":1261,\"bj\":1009},\"attr\":{\"prop\":{\"xue\":553,\"lan\":1225,\"exp\":40,\"type\":0},\"skill\":[{\"key\":\"100210010178\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0}]},\"propPoint\":0,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}},{\"key\":\"1221\",\"model\":\"1221\",\"nickName\":\"逆天魔龙\",\"Id\":\"1786736102425837\",\"loyal\":1000,\"lever\":1,\"eatPet\":0,\"baseProp\":{\"ll\":5,\"zl\":5,\"nl\":5,\"js\":5,\"mj\":5},\"quality\":1,\"savvy\":98,\"grow\":1184,\"qualityValue\":{\"max_xue\":2885,\"max_lan\":1687,\"wg\":1941,\"fg\":1600,\"wf\":2749,\"ff\":2579,\"mz\":1405,\"sd\":1034,\"css\":3030,\"bj\":1229},\"attr\":{\"prop\":{\"xue\":589,\"lan\":1036,\"exp\":0,\"type\":0},\"skill\":[{\"key\":\"100210010188\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1}]},\"propPoint\":0,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}}]'),('氪金老母猪','[{\"key\":\"1221\",\"model\":\"1221\",\"nickName\":\"逆天魔龙\",\"Id\":\"1786736310716174\",\"loyal\":1000,\"lever\":1,\"eatPet\":0,\"baseProp\":{\"ll\":5,\"zl\":5,\"nl\":5,\"js\":5,\"mj\":5},\"quality\":1,\"savvy\":93,\"grow\":1059,\"qualityValue\":{\"max_xue\":2397,\"max_lan\":1975,\"wg\":2079,\"fg\":1705,\"wf\":2504,\"ff\":2629,\"mz\":1364,\"sd\":1015,\"css\":3029,\"bj\":1060},\"attr\":{\"prop\":{\"xue\":576,\"lan\":1106,\"exp\":0,\"type\":0},\"skill\":[{\"key\":\"100210010188\",\"lv\":1,\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":1},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0},{\"isOpen\":0}]},\"propPoint\":0,\"isFight\":0,\"growValue\":0,\"growLv\":0,\"growBreachLv\":0,\"danAttr\":{\"d1\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d2\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0},\"d3\":{\"bj\":0,\"sd\":0,\"mz\":0,\"max_lan\":0,\"max_xue\":0,\"ff\":0,\"wf\":0,\"fg\":0,\"wg\":0,\"css\":0}}}]'),('你是个鸡扒','[]');
/*!40000 ALTER TABLE `xq_man_pet` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_man_pet_view`
--

DROP TABLE IF EXISTS `xq_man_pet_view`;
/*!50001 DROP VIEW IF EXISTS `xq_man_pet_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_man_pet_view` AS SELECT 
 1 AS `name`,
 1 AS `pet`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_prop`
--

DROP TABLE IF EXISTS `xq_man_prop`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_prop` (
  `name` varchar(512) DEFAULT NULL,
  `prop` longtext,
  KEY `idx_xq_man_prop_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_prop`
--

LOCK TABLES `xq_man_prop` WRITE;
/*!40000 ALTER TABLE `xq_man_prop` DISABLE KEYS */;
INSERT INTO `xq_man_prop` VALUES ('q','{\"xue\":340,\"lan\":95,\"exp\":281}'),('cs','{\"xue\":282,\"lan\":85,\"exp\":18}'),('1111','{\"xue\":282,\"lan\":85,\"exp\":33}'),('中崔','{\"xue\":746,\"lan\":165,\"exp\":788}'),('宝宝BUS','{\"xue\":688,\"lan\":155,\"exp\":296}'),('氪金老母猪','{\"xue\":108,\"lan\":55,\"exp\":5}'),('你是个鸡扒','{\"xue\":282,\"lan\":85,\"exp\":18}');
/*!40000 ALTER TABLE `xq_man_prop` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_shifa_way`
--

DROP TABLE IF EXISTS `xq_man_shifa_way`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_shifa_way` (
  `name` varchar(512) DEFAULT NULL,
  `pet_skls` longtext,
  `role_skls` varchar(512) DEFAULT NULL,
  `way` longtext,
  KEY `idx_xq_man_shifa_way_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_shifa_way`
--

LOCK TABLES `xq_man_shifa_way` WRITE;
/*!40000 ALTER TABLE `xq_man_shifa_way` DISABLE KEYS */;
INSERT INTO `xq_man_shifa_way` VALUES ('q','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0'),('cs','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0'),('1111','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0'),('中崔','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0'),('宝宝BUS','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0'),('氪金老母猪','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0'),('你是个鸡扒','[\"100210010178\",\"100210010179\",\"100210010180\",\"100210010181\",\"100210010182\",\"100210010183\",\"100210010185\",\"100210010187\",\"100210010188\",\"100210010191\",\"100210010194\",\"100210010200\",\"100210010202\",\"100210010205\",\"100210010207\",\"100210010211\",\"100210010212\",\"100210010213\",\"100210010216\",\"100210010219\",\"100210010225\",\"100210010240\",\"100210010253\",\"100210010254\",\"100210010257\",\"100210010258\",\"100210010259\",\"100210010260\",\"100210010266\",\"100210010267\",\"100210010270\",\"100210010273\",\"100210010279\",\"100210010294\",\"100210010307\"]','[]','0');
/*!40000 ALTER TABLE `xq_man_shifa_way` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_man_shifa_way_view`
--

DROP TABLE IF EXISTS `xq_man_shifa_way_view`;
/*!50001 DROP VIEW IF EXISTS `xq_man_shifa_way_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_man_shifa_way_view` AS SELECT 
 1 AS `name`,
 1 AS `pet_skls`,
 1 AS `role_skls`,
 1 AS `way`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_skill`
--

DROP TABLE IF EXISTS `xq_man_skill`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_skill` (
  `name` varchar(512) DEFAULT NULL,
  `skill` longtext,
  KEY `idx_xq_man_skill_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_skill`
--

LOCK TABLES `xq_man_skill` WRITE;
/*!40000 ALTER TABLE `xq_man_skill` DISABLE KEYS */;
INSERT INTO `xq_man_skill` VALUES ('q','[]'),('cs','[]'),('1111','[]'),('中崔','[]'),('宝宝BUS','[]'),('氪金老母猪','[]'),('你是个鸡扒','[]');
/*!40000 ALTER TABLE `xq_man_skill` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_star`
--

DROP TABLE IF EXISTS `xq_man_star`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_star` (
  `name` varchar(512) DEFAULT NULL,
  `star` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_star_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_star`
--

LOCK TABLES `xq_man_star` WRITE;
/*!40000 ALTER TABLE `xq_man_star` DISABLE KEYS */;
INSERT INTO `xq_man_star` VALUES ('q','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}'),('cs','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}'),('1111','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}'),('中崔','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}'),('宝宝BUS','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}'),('氪金老母猪','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}'),('你是个鸡扒','{\"num\":0,\"attr\":{\"wg\":0,\"fg\":0,\"max_xue\":0,\"wf\":0,\"ff\":0,\"max_lan\":0,\"bj\":0,\"mz\":0,\"css\":0,\"sd\":0}}');
/*!40000 ALTER TABLE `xq_man_star` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_status`
--

DROP TABLE IF EXISTS `xq_man_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_status` (
  `name` varchar(512) DEFAULT NULL,
  `status` text,
  KEY `idx_xq_man_status_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_status`
--

LOCK TABLES `xq_man_status` WRITE;
/*!40000 ALTER TABLE `xq_man_status` DISABLE KEYS */;
INSERT INTO `xq_man_status` VALUES ('q','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0}}'),('cs','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0}}'),('1111','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0}}'),('中崔','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0}}'),('宝宝BUS','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0},\"cwzhd\":{\"isOpen\":0,\"created\":1786735474630,\"sy\":2569172},\"rwzhd\":{\"isOpen\":0,\"created\":1786735476695,\"sy\":2571237}}'),('氪金老母猪','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0}}'),('你是个鸡扒','{\"qdxc\":{\"created\":0,\"isOpen\":0},\"sbjy\":{\"created\":0,\"isOpen\":0},\"ydxc\":{\"created\":0,\"isOpen\":0},\"bjb\":{\"created\":0,\"isOpen\":0},\"pk\":{\"created\":0,\"isOpen\":0}}');
/*!40000 ALTER TABLE `xq_man_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_task`
--

DROP TABLE IF EXISTS `xq_man_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_task` (
  `name` varchar(512) DEFAULT NULL,
  `task` longtext,
  KEY `idx_xq_man_task_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_task`
--

LOCK TABLES `xq_man_task` WRITE;
/*!40000 ALTER TABLE `xq_man_task` DISABLE KEYS */;
INSERT INTO `xq_man_task` VALUES ('q','[{\"progressIndex\":1,\"key\":\"1002\",\"status\":2,\"taskProgress\":{\"target\":{\"num\":0}}}]'),('cs','[{\"progressIndex\":0,\"key\":\"1001\",\"status\":1,\"taskProgress\":{\"target\":{\"num\":0}}}]'),('1111','[{\"progressIndex\":0,\"key\":\"1001\",\"status\":2,\"taskProgress\":{\"target\":{\"num\":0}}}]'),('中崔','[{\"progressIndex\":0,\"key\":\"1010\",\"status\":1,\"taskProgress\":{\"target\":{\"num\":0}}}]'),('宝宝BUS','[{\"progressIndex\":0,\"key\":\"1008\",\"status\":3,\"taskProgress\":{\"target\":{\"num\":10}}}]'),('氪金老母猪','[{\"progressIndex\":2,\"key\":\"1000\",\"status\":2,\"taskProgress\":{\"target\":{\"num\":0}}}]'),('你是个鸡扒','[{\"progressIndex\":1,\"key\":\"1001\",\"status\":2,\"taskProgress\":{\"target\":{\"num\":0}}}]');
/*!40000 ALTER TABLE `xq_man_task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_task_submit`
--

DROP TABLE IF EXISTS `xq_man_task_submit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_task_submit` (
  `list` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_task_submit_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_task_submit`
--

LOCK TABLES `xq_man_task_submit` WRITE;
/*!40000 ALTER TABLE `xq_man_task_submit` DISABLE KEYS */;
INSERT INTO `xq_man_task_submit` VALUES ('[\"1000\",\"1001\"]','q'),('[\"1000\"]','cs'),('[\"1000\"]','1111'),('[\"1000\",\"1001\",\"1002\",\"1003\",\"1004\",\"1005\",\"1006\",\"1007\",\"1008\",\"1009\"]','中崔'),('[\"1000\",\"1001\",\"1002\",\"1003\",\"1004\",\"1005\",\"1006\",\"1007\"]','宝宝BUS'),('[]','氪金老母猪'),('[\"1000\"]','你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_task_submit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_title`
--

DROP TABLE IF EXISTS `xq_man_title`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_title` (
  `name` varchar(512) DEFAULT NULL,
  `titles` longtext,
  KEY `idx_xq_man_title_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_title`
--

LOCK TABLES `xq_man_title` WRITE;
/*!40000 ALTER TABLE `xq_man_title` DISABLE KEYS */;
INSERT INTO `xq_man_title` VALUES ('q','[]'),('cs','[]'),('1111','[]'),('中崔','[]'),('宝宝BUS','[]'),('氪金老母猪','[]'),('你是个鸡扒','[]');
/*!40000 ALTER TABLE `xq_man_title` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_man_view`
--

DROP TABLE IF EXISTS `xq_man_view`;
/*!50001 DROP VIEW IF EXISTS `xq_man_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_man_view` AS SELECT 
 1 AS `name`,
 1 AS `model`,
 1 AS `models`,
 1 AS `lever`,
 1 AS `msg`,
 1 AS `prop`,
 1 AS `equip`,
 1 AS `skill`,
 1 AS `star`,
 1 AS `jf`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_man_vip`
--

DROP TABLE IF EXISTS `xq_man_vip`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_vip` (
  `jf` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_man_vip_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_vip`
--

LOCK TABLES `xq_man_vip` WRITE;
/*!40000 ALTER TABLE `xq_man_vip` DISABLE KEYS */;
INSERT INTO `xq_man_vip` VALUES (0,'q'),(0,'cs'),(0,'1111'),(0,'中崔'),(0,'宝宝BUS'),(0,'氪金老母猪'),(0,'你是个鸡扒');
/*!40000 ALTER TABLE `xq_man_vip` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_wings`
--

DROP TABLE IF EXISTS `xq_man_wings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_wings` (
  `name` varchar(512) DEFAULT NULL,
  `wings` longtext,
  KEY `idx_xq_man_wings_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_wings`
--

LOCK TABLES `xq_man_wings` WRITE;
/*!40000 ALTER TABLE `xq_man_wings` DISABLE KEYS */;
INSERT INTO `xq_man_wings` VALUES ('q','[]'),('cs','[]'),('1111','[]'),('中崔','[]'),('宝宝BUS','[]'),('氪金老母猪','[]'),('你是个鸡扒','[]');
/*!40000 ALTER TABLE `xq_man_wings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_man_zuoqi`
--

DROP TABLE IF EXISTS `xq_man_zuoqi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_man_zuoqi` (
  `name` varchar(512) DEFAULT NULL,
  `zuoqi` longtext,
  KEY `idx_xq_man_zuoqi_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_man_zuoqi`
--

LOCK TABLES `xq_man_zuoqi` WRITE;
/*!40000 ALTER TABLE `xq_man_zuoqi` DISABLE KEYS */;
INSERT INTO `xq_man_zuoqi` VALUES ('q','[]'),('cs','[]'),('1111','[]'),('中崔','[]'),('宝宝BUS','[]'),('氪金老母猪','[]'),('你是个鸡扒','[]');
/*!40000 ALTER TABLE `xq_man_zuoqi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_money_count`
--

DROP TABLE IF EXISTS `xq_money_count`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_money_count` (
  `name` varchar(512) DEFAULT NULL,
  `now_gold` bigint DEFAULT NULL,
  `now_tale` bigint DEFAULT NULL,
  `old_gold` bigint DEFAULT NULL,
  `old_tale` bigint DEFAULT NULL,
  KEY `idx_xq_money_count_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_money_count`
--

LOCK TABLES `xq_money_count` WRITE;
/*!40000 ALTER TABLE `xq_money_count` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_money_count` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_mzzd`
--

DROP TABLE IF EXISTS `xq_mzzd`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_mzzd` (
  `mzzd` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_mzzd_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_mzzd`
--

LOCK TABLES `xq_mzzd` WRITE;
/*!40000 ALTER TABLE `xq_mzzd` DISABLE KEYS */;
INSERT INTO `xq_mzzd` VALUES (1,'q'),(1,'cs'),(1,'1111'),(1,'中崔'),(1,'宝宝BUS'),(1,'氪金老母猪'),(1,'你是个鸡扒');
/*!40000 ALTER TABLE `xq_mzzd` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_op_log`
--

DROP TABLE IF EXISTS `xq_op_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_op_log` (
  `created` varchar(512) DEFAULT NULL,
  `des` longtext,
  `eip` varchar(512) DEFAULT NULL,
  `ename` varchar(512) DEFAULT NULL,
  `id` bigint DEFAULT NULL,
  `ip` varchar(512) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `suc` varchar(512) DEFAULT NULL,
  `type` bigint DEFAULT NULL,
  KEY `idx_xq_op_log_id` (`id`),
  KEY `idx_xq_op_log_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_op_log`
--

LOCK TABLES `xq_op_log` WRITE;
/*!40000 ALTER TABLE `xq_op_log` DISABLE KEYS */;
INSERT INTO `xq_op_log` VALUES ('1786719596495','上线',NULL,NULL,1786719596495565,'192.168.1.3','q','1',0),('1786719750752','上线',NULL,NULL,1786719750752251,'192.168.1.3','q','1',0),('1786719822994','上线',NULL,NULL,1786719822994533,'192.168.1.3','q','1',0),('1786720609792','上线',NULL,NULL,1786720609792289,'192.168.1.3','q','1',0),('1786721157196','上线',NULL,NULL,1786721157196334,'192.168.1.3','q','1',0),('1786733655229','上线',NULL,NULL,1786733655229113,'113.123.78.245','q','1',0),('1786733798857','上线',NULL,NULL,1786733798857193,'110.152.24.110','cs','1',0),('1786733826315','上线',NULL,NULL,1786733826315904,'110.152.15.209','1111','1',0),('1786733893264','12银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786733893264860,'110.152.15.209','1111','1',7),('1786733915188','上线',NULL,NULL,1786733915188792,'110.152.24.110','cs','1',0),('1786733915881','使用道具10000233 x1',NULL,NULL,1786733915881597,'110.152.15.209','1111','1',1),('1786733919897','上线',NULL,NULL,1786733919897948,'153.67.61.6','中崔','1',0),('1786733942860','12银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786733942860772,'110.152.24.110','cs','1',7),('1786734059248','上线',NULL,NULL,1786734059248658,'58.20.207.138','宝宝BUS','1',0),('1786734123269','12银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734123269390,'153.67.61.6','中崔','1',7),('1786734182513','使用道具10000233 x1',NULL,NULL,1786734182513251,'153.67.61.6','中崔','1',1),('1786734210997','12银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734210997449,'58.20.207.138','宝宝BUS','1',7),('1786734223380','使用道具10000233 x1',NULL,NULL,1786734223380981,'58.20.207.138','宝宝BUS','1',1),('1786734331106','14银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734331106092,'153.67.61.6','中崔','1',7),('1786734507365','16银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734507365597,'153.67.61.6','中崔','1',7),('1786734518846','14银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734518846323,'58.20.207.138','宝宝BUS','1',7),('1786734677879','16银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734677879625,'58.20.207.138','宝宝BUS','1',7),('1786734752848','18银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734752847851,'153.67.61.6','中崔','1',7),('1786734799281','20银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734799281968,'153.67.61.6','中崔','1',7),('1786734866559','18银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734866559446,'58.20.207.138','宝宝BUS','1',7),('1786734875734','22银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734875734997,'153.67.61.6','中崔','1',7),('1786734897256','20银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734897256692,'58.20.207.138','宝宝BUS','1',7),('1786734900142','上线',NULL,NULL,1786734900142209,'113.123.78.245','q','1',0),('1786734930397','22银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734930397736,'58.20.207.138','宝宝BUS','1',7),('1786734945100','24银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734945100410,'58.20.207.138','宝宝BUS','1',7),('1786734990886','24银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke0	-2	调用过程 = jdk.internal.reflect.NativeMethodAccessorImpl	invoke	77	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786734990886962,'153.67.61.6','中崔','1',7),('1786735098852','26银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.GeneratedMethodAccessor13	invoke	-1	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786735098852932,'153.67.61.6','中崔','1',7),('1786735099390','26银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.GeneratedMethodAccessor13	invoke	-1	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786735099390802,'58.20.207.138','宝宝BUS','1',7),('1786735207023','上线',NULL,NULL,1786735207023022,'153.67.61.6','中崔','1',0),('1786735229202','上线',NULL,NULL,1786735229202417,'153.67.61.6','中崔','1',0),('1786735250268','购买商城商品/10000141 x1 价格:1000 类型：gold',NULL,NULL,1786735250268441,'153.67.61.6','中崔','1',3),('1786735257764','上线',NULL,NULL,1786735257764150,'110.152.15.209','1111','1',0),('1786735258589','使用道具10000141 x1',NULL,NULL,1786735258589438,'153.67.61.6','中崔','1',1),('1786735272027','购买商城商品/10000141 x1 价格:1000 类型：gold',NULL,NULL,1786735272027606,'153.67.61.6','中崔','1',3),('1786735276727','使用道具10000141 x1',NULL,NULL,1786735276727853,'153.67.61.6','中崔','1',1),('1786735286570','购买商城商品/10000265 x1 价格:100000 类型：gold',NULL,NULL,1786735286570331,'110.152.15.209','1111','1',3),('1786735292229','使用道具10000265 x1',NULL,NULL,1786735292229825,'110.152.15.209','1111','1',1),('1786735294218','上线',NULL,NULL,1786735294217700,'153.67.61.6','中崔','1',0),('1786735296340','使用道具10000133 x1',NULL,NULL,1786735296340255,'110.152.15.209','1111','1',1),('1786735299430','使用道具10000261 x1',NULL,NULL,1786735299430392,'110.152.15.209','1111','1',1),('1786735301471','使用道具10000261 x1',NULL,NULL,1786735301471857,'110.152.15.209','1111','1',1),('1786735303322','购买商城商品/10000141 x5 价格:5000 类型：gold',NULL,NULL,1786735303322534,'153.67.61.6','中崔','1',3),('1786735303536','使用道具10000261 x1',NULL,NULL,1786735303536570,'110.152.15.209','1111','1',1),('1786735305112','使用道具10000261 x1',NULL,NULL,1786735305112638,'110.152.15.209','1111','1',1),('1786735317224','使用道具10000141 x1',NULL,NULL,1786735317224155,'153.67.61.6','中崔','1',1),('1786735327046','使用道具10000141 x1',NULL,NULL,1786735327046765,'153.67.61.6','中崔','1',1),('1786735330143','使用道具10000141 x1',NULL,NULL,1786735330143156,'153.67.61.6','中崔','1',1),('1786735333748','使用道具10000141 x1',NULL,NULL,1786735333748573,'153.67.61.6','中崔','1',1),('1786735336393','使用道具10000141 x1',NULL,NULL,1786735336393234,'153.67.61.6','中崔','1',1),('1786735342973','上线',NULL,NULL,1786735342973627,'58.20.207.138','宝宝BUS','1',0),('1786735358485','购买商城商品/10000141 x1 价格:1000 类型：gold',NULL,NULL,1786735358485284,'58.20.207.138','宝宝BUS','1',3),('1786735365190','使用道具10000141 x1',NULL,NULL,1786735365190256,'58.20.207.138','宝宝BUS','1',1),('1786735408556','购买商城商品/10000201 x1 价格:200 类型：gold',NULL,NULL,1786735408556873,'110.152.15.209','1111','1',3),('1786735413705','使用道具10000201 x1',NULL,NULL,1786735413705643,'110.152.15.209','1111','1',1),('1786735426600','购买商城商品/10000177 x199 价格:17910 类型：gold',NULL,NULL,1786735426600280,'58.20.207.138','宝宝BUS','1',3),('1786735438466','购买商城商品/10000141 x10 价格:10000 类型：gold',NULL,NULL,1786735438466248,'58.20.207.138','宝宝BUS','1',3),('1786735442605','购买商城商品/10000178 x10 价格:1000 类型：gold',NULL,NULL,1786735442605111,'58.20.207.138','宝宝BUS','1',3),('1786735450222','购买商城商品/10000123 x10 价格:2500 类型：gold',NULL,NULL,1786735450222030,'110.152.15.209','1111','1',3),('1786735453448','使用道具10000141 x1',NULL,NULL,1786735453448903,'58.20.207.138','宝宝BUS','1',1),('1786735456534','使用道具10000141 x1',NULL,NULL,1786735456534384,'58.20.207.138','宝宝BUS','1',1),('1786735458627','使用道具10000141 x1',NULL,NULL,1786735458627145,'58.20.207.138','宝宝BUS','1',1),('1786735461207','使用道具10000141 x1',NULL,NULL,1786735461207164,'58.20.207.138','宝宝BUS','1',1),('1786735462768','使用道具10000141 x1',NULL,NULL,1786735462768014,'58.20.207.138','宝宝BUS','1',1),('1786735464825','使用道具10000141 x1',NULL,NULL,1786735464825469,'58.20.207.138','宝宝BUS','1',1),('1786735466377','使用道具10000141 x1',NULL,NULL,1786735466377016,'58.20.207.138','宝宝BUS','1',1),('1786735468432','使用道具10000141 x1',NULL,NULL,1786735468432598,'58.20.207.138','宝宝BUS','1',1),('1786735470506','使用道具10000141 x1',NULL,NULL,1786735470506351,'58.20.207.138','宝宝BUS','1',1),('1786735472052','使用道具10000141 x1',NULL,NULL,1786735472052912,'58.20.207.138','宝宝BUS','1',1),('1786735474633','使用道具10000178 x1',NULL,NULL,1786735474633674,'58.20.207.138','宝宝BUS','1',1),('1786735476697','使用道具10000177 x1',NULL,NULL,1786735476697879,'58.20.207.138','宝宝BUS','1',1),('1786735510514','购买商城商品/10000260 x10 价格:150000 类型：gold',NULL,NULL,1786735510514037,'110.152.15.209','1111','1',3),('1786735518233','使用道具10000260 x1',NULL,NULL,1786735518233490,'110.152.15.209','1111','1',1),('1786735520866','使用道具10000260 x1',NULL,NULL,1786735520866751,'110.152.15.209','1111','1',1),('1786735523378','使用道具10000260 x1',NULL,NULL,1786735523378357,'110.152.15.209','1111','1',1),('1786735525439','使用道具10000260 x1',NULL,NULL,1786735525439360,'110.152.15.209','1111','1',1),('1786735527464','使用道具10000260 x1',NULL,NULL,1786735527464886,'110.152.15.209','1111','1',1),('1786735529554','使用道具10000260 x1',NULL,NULL,1786735529554374,'110.152.15.209','1111','1',1),('1786735531087','使用道具10000260 x1',NULL,NULL,1786735531087357,'110.152.15.209','1111','1',1),('1786735532616','使用道具10000260 x1',NULL,NULL,1786735532616039,'110.152.15.209','1111','1',1),('1786735534140','使用道具10000260 x1',NULL,NULL,1786735534140368,'110.152.15.209','1111','1',1),('1786735536212','使用道具10000260 x1',NULL,NULL,1786735536212451,'110.152.15.209','1111','1',1),('1786735550611','购买商城商品/10000261 x10 价格:50000 类型：gold',NULL,NULL,1786735550611821,'110.152.15.209','1111','1',3),('1786735576887','使用道具10000261 x1',NULL,NULL,1786735576887175,'110.152.15.209','1111','1',1),('1786735578933','使用道具10000261 x1',NULL,NULL,1786735578933340,'110.152.15.209','1111','1',1),('1786735580917','使用道具10000261 x1',NULL,NULL,1786735580917238,'110.152.15.209','1111','1',1),('1786735585033','使用道具10000261 x1',NULL,NULL,1786735585033097,'110.152.15.209','1111','1',1),('1786735586609','使用道具10000261 x1',NULL,NULL,1786735586608574,'110.152.15.209','1111','1',1),('1786735588633','使用道具10000261 x1',NULL,NULL,1786735588633774,'110.152.15.209','1111','1',1),('1786735592757','使用道具10000261 x1',NULL,NULL,1786735592757391,'110.152.15.209','1111','1',1),('1786735594784','使用道具10000261 x1',NULL,NULL,1786735594784573,'110.152.15.209','1111','1',1),('1786735597872','使用道具10000261 x1',NULL,NULL,1786735597872526,'110.152.15.209','1111','1',1),('1786735599920','使用道具10000261 x1',NULL,NULL,1786735599920664,'110.152.15.209','1111','1',1),('1786735723492','28银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.GeneratedMethodAccessor13	invoke	-1	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786735723492721,'153.67.61.6','中崔','1',7),('1786735875715','购买商城商品/10000032 x1 价格:400 类型：gold',NULL,NULL,1786735875715659,'58.20.207.138','宝宝BUS','1',3),('1786735885538','购买商城商品/10000113 x10 价格:8000 类型：gold',NULL,NULL,1786735885538730,'58.20.207.138','宝宝BUS','1',3),('1786735886387','购买商城商品/10000265 x1 价格:100000 类型：gold',NULL,NULL,1786735886387721,'153.67.61.6','中崔','1',3),('1786735896725','使用道具10000265 x1',NULL,NULL,1786735896725299,'153.67.61.6','中崔','1',1),('1786735902884','使用道具10000133 x1',NULL,NULL,1786735902884133,'153.67.61.6','中崔','1',1),('1786735942005','使用道具10000261 x1',NULL,NULL,1786735942005055,'153.67.61.6','中崔','1',1),('1786735946680','使用道具10000261 x1',NULL,NULL,1786735946680676,'153.67.61.6','中崔','1',1),('1786735949811','使用道具10000261 x1',NULL,NULL,1786735949811737,'153.67.61.6','中崔','1',1),('1786735951817','使用道具10000261 x1',NULL,NULL,1786735951817680,'153.67.61.6','中崔','1',1),('1786735965231','30银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.GeneratedMethodAccessor13	invoke	-1	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786735965231114,'153.67.61.6','中崔','1',7),('1786736003793','购买商城商品/10000113 x199 价格:159200 类型：gold',NULL,NULL,1786736003793870,'58.20.207.138','宝宝BUS','1',3),('1786736052355','上线',NULL,NULL,1786736052355509,'27.13.179.140','氪金老母猪','1',0),('1786736070430','购买商城商品/10000261 x1 价格:5000 类型：gold',NULL,NULL,1786736070430285,'58.20.207.138','宝宝BUS','1',3),('1786736089539','购买商城商品/10000265 x1 价格:100000 类型：gold',NULL,NULL,1786736089539689,'58.20.207.138','宝宝BUS','1',3),('1786736097268','使用道具10000265 x1',NULL,NULL,1786736097268626,'58.20.207.138','宝宝BUS','1',1),('1786736102427','使用道具10000133 x1',NULL,NULL,1786736102427915,'58.20.207.138','宝宝BUS','1',1),('1786736122136','购买商城商品/10000123 x100 价格:25000 类型：gold',NULL,NULL,1786736122136750,'153.67.61.6','中崔','1',3),('1786736129336','购买商城商品/10000124 x199 价格:39800 类型：gold',NULL,NULL,1786736129336108,'58.20.207.138','宝宝BUS','1',3),('1786736181665','上线',NULL,NULL,1786736181665099,'124.160.210.233','你是个鸡扒','1',0),('1786736204478','上线',NULL,NULL,1786736204478810,'27.13.179.140','氪金老母猪','1',0),('1786736206594','上线',NULL,NULL,1786736206594235,'27.13.179.140','氪金老母猪','1',0),('1786736208633','上线',NULL,NULL,1786736208633695,'27.13.179.140','氪金老母猪','1',0),('1786736245080','上线',NULL,NULL,1786736245080260,'27.13.179.140','氪金老母猪','1',0),('1786736261133','12银两 调用过程 = java.lang.Thread	getStackTrace	1619	调用过程 = my.utils.StackTraceUtils	getAllTag	11	调用过程 = my.service.manService	saveMoney	2689	调用过程 = my.service.rewardService	saveRewards	1348	调用过程 = my.service.rewardService	saveRewardsByTask	1368	调用过程 = my.service.taskService	submitOneTask	667	调用过程 = my.service.taskService	submitTask	613	调用过程 = jdk.internal.reflect.GeneratedMethodAccessor13	invoke	-1	调用过程 = jdk.internal.reflect.DelegatingMethodAccessorImpl	invoke	43	调用过程 = java.lang.reflect.Method	invoke	569	调用过程 = my.startBef	invokeMethod	190	当前方法 = my.service.manService.saveMoney',NULL,NULL,1786736261133809,'124.160.210.233','你是个鸡扒','1',7),('1786736292653','购买商城商品/10000265 x1 价格:100000 类型：gold',NULL,NULL,1786736292653744,'27.13.179.140','氪金老母猪','1',3),('1786736306999','使用道具10000265 x1',NULL,NULL,1786736306999105,'27.13.179.140','氪金老母猪','1',1),('1786736310718','使用道具10000133 x1',NULL,NULL,1786736310718480,'27.13.179.140','氪金老母猪','1',1),('1786736313368','使用道具10000261 x1',NULL,NULL,1786736313368085,'27.13.179.140','氪金老母猪','1',1),('1786736417405','购买商城商品/10000123 x32 价格:8000 类型：gold',NULL,NULL,1786736417405604,'58.20.207.138','宝宝BUS','1',3),('1786736472124','购买商城商品/10000260 x19 价格:285000 类型：gold',NULL,NULL,1786736472124671,'58.20.207.138','宝宝BUS','1',3),('1786736476248','购买商城商品/10000261 x19 价格:95000 类型：gold',NULL,NULL,1786736476248196,'58.20.207.138','宝宝BUS','1',3);
/*!40000 ALTER TABLE `xq_op_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_cb`
--

DROP TABLE IF EXISTS `xq_order_cb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_cb` (
  `jf1` bigint DEFAULT NULL,
  `jf2` bigint DEFAULT NULL,
  `jf3` bigint DEFAULT NULL,
  `jf4` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_order_cb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_cb`
--

LOCK TABLES `xq_order_cb` WRITE;
/*!40000 ALTER TABLE `xq_order_cb` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_cb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_cb_bp`
--

DROP TABLE IF EXISTS `xq_order_cb_bp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_cb_bp` (
  `bpid` bigint DEFAULT NULL,
  `jf` bigint DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_cb_bp`
--

LOCK TABLES `xq_order_cb_bp` WRITE;
/*!40000 ALTER TABLE `xq_order_cb_bp` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_cb_bp` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_dzfsb`
--

DROP TABLE IF EXISTS `xq_order_dzfsb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_dzfsb` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_dzfsb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_dzfsb`
--

LOCK TABLES `xq_order_dzfsb` WRITE;
/*!40000 ALTER TABLE `xq_order_dzfsb` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_dzfsb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv`
--

DROP TABLE IF EXISTS `xq_order_lv`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv`
--

LOCK TABLES `xq_order_lv` WRITE;
/*!40000 ALTER TABLE `xq_order_lv` DISABLE KEYS */;
INSERT INTO `xq_order_lv` VALUES (12,'xs_nan_t2','中崔',1786736009462),(11,'xs_nan_t1','宝宝BUS',1786735153465),(5,'xs_nan_t1','q',1786721277394),(4,'xs_nan_t1','1111',1786733937475),(4,'xs_nan_t1','cs',1786733999464),(4,'xs_nan_t2','你是个鸡扒',1786736311463);
/*!40000 ALTER TABLE `xq_order_lv` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv_dj`
--

DROP TABLE IF EXISTS `xq_order_lv_dj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv_dj` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_dj_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv_dj`
--

LOCK TABLES `xq_order_lv_dj` WRITE;
/*!40000 ALTER TABLE `xq_order_lv_dj` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_lv_dj` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv_lc`
--

DROP TABLE IF EXISTS `xq_order_lv_lc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv_lc` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_lc_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv_lc`
--

LOCK TABLES `xq_order_lv_lc` WRITE;
/*!40000 ALTER TABLE `xq_order_lv_lc` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_lv_lc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv_ms`
--

DROP TABLE IF EXISTS `xq_order_lv_ms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv_ms` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_ms_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv_ms`
--

LOCK TABLES `xq_order_lv_ms` WRITE;
/*!40000 ALTER TABLE `xq_order_lv_ms` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_lv_ms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv_qm`
--

DROP TABLE IF EXISTS `xq_order_lv_qm`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv_qm` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_qm_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv_qm`
--

LOCK TABLES `xq_order_lv_qm` WRITE;
/*!40000 ALTER TABLE `xq_order_lv_qm` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_lv_qm` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv_ty`
--

DROP TABLE IF EXISTS `xq_order_lv_ty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv_ty` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_ty_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv_ty`
--

LOCK TABLES `xq_order_lv_ty` WRITE;
/*!40000 ALTER TABLE `xq_order_lv_ty` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_lv_ty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_lv_ym`
--

DROP TABLE IF EXISTS `xq_order_lv_ym`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_lv_ym` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_lv_ym_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_lv_ym`
--

LOCK TABLES `xq_order_lv_ym` WRITE;
/*!40000 ALTER TABLE `xq_order_lv_ym` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_lv_ym` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_sez_e`
--

DROP TABLE IF EXISTS `xq_order_sez_e`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_sez_e` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sez` longtext,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_sez_e_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_sez_e`
--

LOCK TABLES `xq_order_sez_e` WRITE;
/*!40000 ALTER TABLE `xq_order_sez_e` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_sez_e` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_sez_shan`
--

DROP TABLE IF EXISTS `xq_order_sez_shan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_sez_shan` (
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `name` varchar(512) DEFAULT NULL,
  `sez` longtext,
  `sort` bigint DEFAULT NULL,
  KEY `idx_xq_order_sez_shan_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_sez_shan`
--

LOCK TABLES `xq_order_sez_shan` WRITE;
/*!40000 ALTER TABLE `xq_order_sez_shan` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_sez_shan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_order_zl`
--

DROP TABLE IF EXISTS `xq_order_zl`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_order_zl` (
  `name` varchar(512) DEFAULT NULL,
  `sort` bigint DEFAULT NULL,
  `zl` longtext,
  KEY `idx_xq_order_zl_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_order_zl`
--

LOCK TABLES `xq_order_zl` WRITE;
/*!40000 ALTER TABLE `xq_order_zl` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_order_zl` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_pet_equip`
--

DROP TABLE IF EXISTS `xq_pet_equip`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_pet_equip` (
  `equip` longtext,
  `name` varchar(512) DEFAULT NULL,
  KEY `idx_xq_pet_equip_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_pet_equip`
--

LOCK TABLES `xq_pet_equip` WRITE;
/*!40000 ALTER TABLE `xq_pet_equip` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_pet_equip` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_prison`
--

DROP TABLE IF EXISTS `xq_prison`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_prison` (
  `name` varchar(512) DEFAULT NULL,
  `total` bigint DEFAULT NULL,
  KEY `idx_xq_prison_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_prison`
--

LOCK TABLES `xq_prison` WRITE;
/*!40000 ALTER TABLE `xq_prison` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_prison` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_role`
--

DROP TABLE IF EXISTS `xq_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_role` (
  `id` bigint DEFAULT NULL,
  `ip` varchar(512) DEFAULT NULL,
  `lever` bigint DEFAULT NULL,
  `model` longtext,
  `models` longtext,
  `name` varchar(512) DEFAULT NULL,
  `username` varchar(512) DEFAULT NULL,
  KEY `idx_xq_role_id` (`id`),
  KEY `idx_xq_role_name` (`name`),
  KEY `idx_xq_role_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_role`
--

LOCK TABLES `xq_role` WRITE;
/*!40000 ALTER TABLE `xq_role` DISABLE KEYS */;
INSERT INTO `xq_role` VALUES (1786719594899952,NULL,5,'xs_nan_t1','[\"xs_nan_t1\"]','q','123456'),(1786733798323871,NULL,4,'xs_nan_t1','[\"xs_nan_t1\"]','cs','123456789'),(1786733825798859,NULL,4,'xs_nan_t1','[\"xs_nan_t1\"]','1111','n13565336283'),(1786733918828328,NULL,12,'xs_nan_t2','[\"xs_nan_t2\"]','中崔','1727875430'),(1786734058746950,NULL,11,'xs_nan_t1','[\"xs_nan_t1\"]','宝宝BUS','jj936823'),(1786736051847964,NULL,1,'xs_nan_t1','[\"xs_nan_t1\"]','氪金老母猪','qwer9999'),(1786736181158789,NULL,4,'xs_nan_t2','[\"xs_nan_t2\"]','你是个鸡扒','a79986');
/*!40000 ALTER TABLE `xq_role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_shop`
--

DROP TABLE IF EXISTS `xq_shop`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_shop` (
  `created` varchar(512) DEFAULT NULL,
  `goods` longtext,
  `id` bigint DEFAULT NULL,
  `kan` bigint DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `price_type` bigint DEFAULT NULL,
  `sale` bigint DEFAULT NULL,
  `type` bigint DEFAULT NULL,
  KEY `idx_xq_shop_id` (`id`),
  KEY `idx_xq_shop_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_shop`
--

LOCK TABLES `xq_shop` WRITE;
/*!40000 ALTER TABLE `xq_shop` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_shop` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xq_user`
--

DROP TABLE IF EXISTS `xq_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_user` (
  `allowed_ip` varchar(512) DEFAULT '[]',
  `created` varchar(512) DEFAULT NULL,
  `email` longtext,
  `id` bigint DEFAULT NULL,
  `ip` varchar(512) DEFAULT NULL,
  `online` bigint DEFAULT NULL,
  `password` varchar(512) DEFAULT NULL,
  `username` varchar(512) DEFAULT NULL,
  `verify` bigint DEFAULT NULL,
  KEY `idx_xq_user_id` (`id`),
  KEY `idx_xq_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_user`
--

LOCK TABLES `xq_user` WRITE;
/*!40000 ALTER TABLE `xq_user` DISABLE KEYS */;
INSERT INTO `xq_user` VALUES ('[\"192.168.1.3\",\"113.123.78.245\",\"113.123.78.245\"]','1786719583808','',1786719583807774,'113.123.78.245',1786734897594,'123456','123456',0),('[\"110.152.24.110\",\"110.152.24.110\"]','1786733779832','',1786733779832540,'110.152.24.110',1786733910173,'123456789','123456789',0),('[\"110.152.15.209\",\"110.152.15.209\"]','1786733815498','',1786733815498744,'110.152.15.209',1786735254677,'13565336283','n13565336283',0),('[\"153.67.61.6\",\"153.67.61.6\",\"153.67.61.6\"]','1786733899926','',1786733899926252,'153.67.61.6',1786735293186,'amly147258','1727875430',0),('[\"58.20.207.138\",\"58.20.207.138\"]','1786734032927','',1786734032927959,'58.20.207.138',1786735339360,'jj936823','jj936823',0),('[\"27.13.179.140\",\"27.13.179.140\",\"27.13.179.140\"]','1786736031771','',1786736031771851,'27.13.179.140',1786736240720,'qwer9999','qwer9999',0),('[\"124.160.210.233\"]','1786736139725','',1786736139725207,'124.160.210.233',1786736148305,'qwertyuiop00','a79986',0);
/*!40000 ALTER TABLE `xq_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `xq_user_view`
--

DROP TABLE IF EXISTS `xq_user_view`;
/*!50001 DROP VIEW IF EXISTS `xq_user_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `xq_user_view` AS SELECT 
 1 AS `allowed_ip`,
 1 AS `created`,
 1 AS `email`,
 1 AS `id`,
 1 AS `ip`,
 1 AS `online`,
 1 AS `password`,
 1 AS `username`,
 1 AS `verify`,
 1 AS `ishei`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `xq_wzy_sign`
--

DROP TABLE IF EXISTS `xq_wzy_sign`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xq_wzy_sign` (
  `jf` bigint DEFAULT NULL,
  `list` longtext,
  `name` varchar(512) DEFAULT NULL,
  `promotion` varchar(512) DEFAULT NULL,
  KEY `idx_xq_wzy_sign_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xq_wzy_sign`
--

LOCK TABLES `xq_wzy_sign` WRITE;
/*!40000 ALTER TABLE `xq_wzy_sign` DISABLE KEYS */;
/*!40000 ALTER TABLE `xq_wzy_sign` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'xunqin'
--

--
-- Dumping routines for database 'xunqin'
--

--
-- Final view structure for view `xq_ac_farm_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_ac_farm_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_ac_farm_view` AS select `xq_ac_farm`.`gain` AS `gain`,`xq_ac_farm`.`name` AS `name`,`xq_ac_farm`.`td` AS `td`,`xq_ac_farm`.`times` AS `times` from `xq_ac_farm` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_ac_jimai_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_ac_jimai_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_ac_jimai_view` AS select `xq_ac_jimai`.`bzj` AS `bzj`,`xq_ac_jimai`.`created` AS `created`,`xq_ac_jimai`.`endday` AS `endday`,`xq_ac_jimai`.`gd` AS `gd`,`xq_ac_jimai`.`gdtype` AS `gdtype`,`xq_ac_jimai`.`id` AS `id`,`xq_ac_jimai`.`kword` AS `kword`,`xq_ac_jimai`.`name` AS `name`,`xq_ac_jimai`.`num` AS `num`,`xq_ac_jimai`.`price` AS `price`,`xq_ac_jimai`.`pricetype` AS `pricetype`,`xq_ac_jimai`.`type` AS `type` from `xq_ac_jimai` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_ac_pk_jj_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_ac_pk_jj_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_ac_pk_jj_view` AS select `xq_ac_person_jj`.`name` AS `name`,`xq_ac_person_jj`.`jd` AS `jd` from `xq_ac_person_jj` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_ac_pk_pw_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_ac_pk_pw_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_ac_pk_pw_view` AS select `xq_ac_paiwei`.`name` AS `name`,`xq_ac_paiwei`.`jd` AS `jd` from `xq_ac_paiwei` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_ac_st_sign_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_ac_st_sign_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_ac_st_sign_view` AS select `s`.`name` AS `name`,`r`.`lever` AS `lever` from (`xq_ac_st_sign` `s` left join `xq_role` `r` on((`s`.`name` = `r`.`name`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_ac_tianti_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_ac_tianti_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_ac_tianti_view` AS select `xq_ac_tianti`.`name` AS `name`,`xq_ac_tianti`.`ts` AS `ts` from `xq_ac_tianti` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_grounding_goods_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_grounding_goods_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_grounding_goods_view` AS select `xq_grounding_goods`.`list` AS `list`,`xq_grounding_goods`.`name` AS `name` from `xq_grounding_goods` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_lv_prop_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_lv_prop_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_lv_prop_view` AS select `xq_role`.`name` AS `name`,`xq_role`.`lever` AS `lever` from `xq_role` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_man_equip_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_man_equip_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_man_equip_view` AS select `xq_man_equip`.`equip` AS `equip`,`xq_man_equip`.`name` AS `name` from `xq_man_equip` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_man_huoban_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_man_huoban_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_man_huoban_view` AS select `xq_man_huoban`.`huoban` AS `huoban`,`xq_man_huoban`.`name` AS `name` from `xq_man_huoban` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_man_package_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_man_package_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_man_package_view` AS select `xq_man_package`.`bbn` AS `bbn`,`xq_man_package`.`ckn` AS `ckn`,`xq_man_package`.`name` AS `name`,`xq_man_package`.`package` AS `package`,`xq_man_package`.`tale` AS `tale` from `xq_man_package` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_man_pet_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_man_pet_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_man_pet_view` AS select `xq_man_pet`.`name` AS `name`,`xq_man_pet`.`pet` AS `pet` from `xq_man_pet` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_man_shifa_way_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_man_shifa_way_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_man_shifa_way_view` AS select `xq_man_shifa_way`.`name` AS `name`,`xq_man_shifa_way`.`pet_skls` AS `pet_skls`,`xq_man_shifa_way`.`role_skls` AS `role_skls`,`xq_man_shifa_way`.`way` AS `way` from `xq_man_shifa_way` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_man_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_man_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_man_view` AS select `r`.`name` AS `name`,`r`.`model` AS `model`,`r`.`models` AS `models`,`r`.`lever` AS `lever`,`m`.`msg` AS `msg`,`p`.`prop` AS `prop`,`e`.`equip` AS `equip`,`s`.`skill` AS `skill`,`st`.`star` AS `star`,`v`.`jf` AS `jf` from ((((((`xq_role` `r` left join `xq_man_msg` `m` on((`r`.`name` = `m`.`name`))) left join `xq_man_prop` `p` on((`r`.`name` = `p`.`name`))) left join `xq_man_equip` `e` on((`r`.`name` = `e`.`name`))) left join `xq_man_skill` `s` on((`r`.`name` = `s`.`name`))) left join `xq_man_star` `st` on((`r`.`name` = `st`.`name`))) left join `xq_man_vip` `v` on((`r`.`name` = `v`.`name`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `xq_user_view`
--

/*!50001 DROP VIEW IF EXISTS `xq_user_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`xunqin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `xq_user_view` AS select `xq_user`.`allowed_ip` AS `allowed_ip`,`xq_user`.`created` AS `created`,`xq_user`.`email` AS `email`,`xq_user`.`id` AS `id`,`xq_user`.`ip` AS `ip`,`xq_user`.`online` AS `online`,`xq_user`.`password` AS `password`,`xq_user`.`username` AS `username`,`xq_user`.`verify` AS `verify`,0 AS `ishei` from `xq_user` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-15  5:07:53
