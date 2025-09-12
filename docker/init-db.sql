-- Initialisation de la base de données PostgreSQL
-- Ce fichier garantit les bonnes permissions pour project_user

-- Création de l'utilisateur s'il n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'project_user') THEN
        CREATE USER project_user WITH PASSWORD 'project_pass';
    END IF;
END
$$;

-- Attribution des privilèges complets
GRANT ALL PRIVILEGES ON DATABASE project_service_dev TO project_user;
GRANT ALL ON SCHEMA public TO project_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO project_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO project_user;

-- Privilèges par défaut pour les futurs objets
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO project_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO project_user;

-- Permission de créer des objets
ALTER USER project_user CREATEDB;