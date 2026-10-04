SET NAMES utf8mb4;
-- =====================================================================
-- PassionBook (Reto Lector) - Esquema de base de datos (MySQL 8.0.16+)
-- =====================================================================
DROP DATABASE IF EXISTS passionbook;
CREATE DATABASE passionbook
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE passionbook;

-- ---------------------------------------------------------------------
-- 1. usuarios
-- Datos de cuenta, perfil y puntaje acumulado (para el ranking).
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id_usuario          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre              VARCHAR(100)  NOT NULL,
  apellido            VARCHAR(100)  NOT NULL,
  email               VARCHAR(150)  NOT NULL,
  password_hash       VARCHAR(255)  NOT NULL,          -- hash bcrypt
  avatar_url          VARCHAR(255)  NULL,
  biografia           VARCHAR(500)  NULL,
  puntos_totales      INT UNSIGNED  NOT NULL DEFAULT 0, -- se actualiza al completar libros
  activo              TINYINT(1)    NOT NULL DEFAULT 1,
  fecha_registro      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_email (email),
  -- Acelera la consulta del ranking (ORDER BY puntos_totales DESC)
  KEY idx_usuarios_puntos (puntos_totales)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. categorias (géneros literarios)
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(80)  NOT NULL,
  descripcion  VARCHAR(255) NULL,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. libros (catálogo compartido de la plataforma)
-- id_creador es opcional: indica qué usuario registró el libro.
-- ---------------------------------------------------------------------
CREATE TABLE libros (
  id_libro         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  titulo           VARCHAR(200)  NOT NULL,
  autor            VARCHAR(150)  NOT NULL,
  id_categoria     INT UNSIGNED  NOT NULL,
  isbn             VARCHAR(20)   NULL,
  num_paginas      SMALLINT UNSIGNED NULL,
  anio_publicacion SMALLINT UNSIGNED NULL,
  sinopsis         TEXT          NULL,
  portada_url      VARCHAR(255)  NULL,
  id_creador       INT UNSIGNED  NULL,
  fecha_registro   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_libro),
  UNIQUE KEY uq_libros_isbn (isbn),
  KEY idx_libros_categoria (id_categoria),
  KEY idx_libros_titulo (titulo),
  KEY idx_libros_autor (autor),
  CONSTRAINT fk_libros_categoria
    FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_libros_creador
    FOREIGN KEY (id_creador) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. lecturas_usuario
-- Relación usuario-libro con el estado de lectura.
-- Un usuario solo puede tener un registro por libro.
-- ---------------------------------------------------------------------
CREATE TABLE lecturas_usuario (
  id_lectura       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario       INT UNSIGNED NOT NULL,
  id_libro         INT UNSIGNED NOT NULL,
  estado           ENUM('pendiente','en_lectura','completado')
                   NOT NULL DEFAULT 'pendiente',
  fecha_inicio     DATE NULL,
  fecha_fin        DATE NULL,                 -- base para estadísticas por mes
  calificacion     TINYINT UNSIGNED NULL,     -- 1 a 5
  puntos_otorgados INT UNSIGNED NOT NULL DEFAULT 0,
  fecha_registro   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_lectura),
  UNIQUE KEY uq_lectura_usuario_libro (id_usuario, id_libro),
  -- Consultas de estadísticas y metas: libros completados por usuario/fecha
  KEY idx_lecturas_usuario_estado_fecha (id_usuario, estado, fecha_fin),
  KEY idx_lecturas_libro (id_libro),
  CONSTRAINT fk_lecturas_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_lecturas_libro
    FOREIGN KEY (id_libro) REFERENCES libros (id_libro)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_lecturas_calificacion
    CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5),
  CONSTRAINT chk_lecturas_fechas
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. metas
-- Meta mensual o anual. Para metas anuales, mes = 0 (así la llave única
-- evita duplicados, ya que MySQL permite varios NULL en un UNIQUE).
-- El % de avance se calcula en consulta contando lecturas completadas.
-- ---------------------------------------------------------------------
CREATE TABLE metas (
  id_meta           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario        INT UNSIGNED NOT NULL,
  tipo_periodo      ENUM('mensual','anual') NOT NULL,
  anio              SMALLINT UNSIGNED NOT NULL,
  mes               TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- 1-12 mensual, 0 anual
  cantidad_objetivo SMALLINT UNSIGNED NOT NULL,
  fecha_creacion    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_meta),
  UNIQUE KEY uq_meta_periodo (id_usuario, tipo_periodo, anio, mes),
  CONSTRAINT fk_metas_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_metas_cantidad CHECK (cantidad_objetivo > 0),
  CONSTRAINT chk_metas_mes CHECK (
    (tipo_periodo = 'anual'   AND mes = 0) OR
    (tipo_periodo = 'mensual' AND mes BETWEEN 1 AND 12)
  )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. insignias (catálogo de logros)
-- criterio_tipo + criterio_valor permiten evaluar automáticamente
-- si un usuario merece la insignia.
-- ---------------------------------------------------------------------
CREATE TABLE insignias (
  id_insignia    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo         VARCHAR(50)  NOT NULL,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    VARCHAR(255) NOT NULL,
  icono          VARCHAR(100) NULL,
  criterio_tipo  ENUM('libros_completados','puntos','metas_cumplidas') NOT NULL,
  criterio_valor INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_insignia),
  UNIQUE KEY uq_insignias_codigo (codigo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. usuario_insignias (insignias obtenidas)
-- Llave primaria compuesta: una insignia solo se gana una vez.
-- ---------------------------------------------------------------------
CREATE TABLE usuario_insignias (
  id_usuario      INT UNSIGNED NOT NULL,
  id_insignia     INT UNSIGNED NOT NULL,
  fecha_obtenida  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_insignia),
  KEY idx_ui_insignia (id_insignia),
  CONSTRAINT fk_ui_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ui_insignia
    FOREIGN KEY (id_insignia) REFERENCES insignias (id_insignia)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
