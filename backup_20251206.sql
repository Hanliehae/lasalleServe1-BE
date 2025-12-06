--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: lasalle_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO lasalle_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: lasalle_user
--

CREATE TABLE public.assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    location character varying(255) NOT NULL,
    total_stock integer DEFAULT 0 NOT NULL,
    available_stock integer DEFAULT 0 NOT NULL,
    condition character varying(50) NOT NULL,
    description text,
    acquisition_year character varying(9),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    stock_baik integer DEFAULT 0,
    stock_rusak_ringan integer DEFAULT 0,
    stock_rusak_berat integer DEFAULT 0,
    CONSTRAINT assets_category_check CHECK (((category)::text = ANY ((ARRAY['ruangan'::character varying, 'fasilitas'::character varying])::text[]))),
    CONSTRAINT assets_check CHECK (((available_stock <= total_stock) AND (available_stock >= 0))),
    CONSTRAINT assets_condition_check CHECK (((condition)::text = ANY ((ARRAY['baik'::character varying, 'rusak_ringan'::character varying, 'rusak_berat'::character varying])::text[])))
);


ALTER TABLE public.assets OWNER TO lasalle_user;

--
-- Name: damage_reports; Type: TABLE; Schema: public; Owner: lasalle_user
--

CREATE TABLE public.damage_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid NOT NULL,
    reported_by uuid NOT NULL,
    description text NOT NULL,
    priority character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    photo_url text,
    notes text,
    academic_year character varying(9),
    semester character varying(10),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT damage_reports_priority_check CHECK (((priority)::text = ANY ((ARRAY['rendah'::character varying, 'sedang'::character varying, 'tinggi'::character varying])::text[]))),
    CONSTRAINT damage_reports_semester_check CHECK (((semester)::text = ANY ((ARRAY['ganjil'::character varying, 'genap'::character varying])::text[]))),
    CONSTRAINT damage_reports_status_check CHECK (((status)::text = ANY ((ARRAY['menunggu'::character varying, 'dalam_perbaikan'::character varying, 'selesai'::character varying])::text[])))
);


ALTER TABLE public.damage_reports OWNER TO lasalle_user;

--
-- Name: loan_items; Type: TABLE; Schema: public; Owner: lasalle_user
--

CREATE TABLE public.loan_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    loan_id uuid,
    asset_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    returned_condition character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    returned_at timestamp with time zone,
    CONSTRAINT loan_items_returned_condition_check CHECK (((returned_condition)::text = ANY ((ARRAY['baik'::character varying, 'rusak_ringan'::character varying, 'rusak_berat'::character varying, 'hilang'::character varying])::text[])))
);


ALTER TABLE public.loan_items OWNER TO lasalle_user;

--
-- Name: loans; Type: TABLE; Schema: public; Owner: lasalle_user
--

CREATE TABLE public.loans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    borrower_id uuid NOT NULL,
    room_id uuid,
    purpose text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    status character varying(50) NOT NULL,
    academic_year character varying(9) NOT NULL,
    semester character varying(10) NOT NULL,
    returned_at timestamp with time zone,
    return_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT loans_check CHECK ((end_date >= start_date)),
    CONSTRAINT loans_semester_check CHECK (((semester)::text = ANY ((ARRAY['ganjil'::character varying, 'genap'::character varying])::text[]))),
    CONSTRAINT loans_status_check CHECK (((status)::text = ANY ((ARRAY['menunggu'::character varying, 'disetujui'::character varying, 'ditolak'::character varying, 'selesai'::character varying, 'menunggu_pengembalian'::character varying])::text[])))
);


ALTER TABLE public.loans OWNER TO lasalle_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: lasalle_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    department character varying(255),
    student_id character varying(100),
    phone character varying(20),
    ktm_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['mahasiswa'::character varying, 'dosen'::character varying, 'staf'::character varying, 'staf_buf'::character varying, 'admin_buf'::character varying, 'kepala_buf'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO lasalle_user;

--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: lasalle_user
--

COPY public.assets (id, name, category, location, total_stock, available_stock, condition, description, acquisition_year, created_at, updated_at, stock_baik, stock_rusak_ringan, stock_rusak_berat) FROM stdin;
08cc0197-b14d-4e46-9b6e-795031c07489	Proyektor LCD	fasilitas	Gedung A Lantai 2	5	3	baik	Proyektor LCD resolusi 1080p	2023	2025-11-30 16:40:13.126212+08	2025-12-01 17:58:12.942993+08	0	0	0
dd226c0b-d694-47d9-9c0d-a2ce0e4e53c8	kursi	fasilitas	agustinus	120	120	rusak_ringan		\N	2025-12-05 21:16:13.588983+08	2025-12-05 21:16:13.588983+08	0	0	0
\.


--
-- Data for Name: damage_reports; Type: TABLE DATA; Schema: public; Owner: lasalle_user
--

COPY public.damage_reports (id, asset_id, reported_by, description, priority, status, photo_url, notes, academic_year, semester, created_at, updated_at) FROM stdin;
5eb45883-aaf8-4e51-8fd1-c8bcbad43861	08cc0197-b14d-4e46-9b6e-795031c07489	1a4daae2-6431-48fe-a728-12a2f9f2ec1b	Layar proyektor terdapat garis-garis dan warna tidak normal	tinggi	menunggu		Perlu pengecekan segera	2025/2026	ganjil	2025-11-30 16:53:02.645123+08	2025-11-30 16:53:02.645123+08
893f31f8-ecf1-41ec-b7d2-5adabdb6d688	08cc0197-b14d-4e46-9b6e-795031c07489	7910b94f-2259-41a3-acab-122fd7639291	Testing laporan kerusakan	sedang	menunggu		Ini testing	2025/2026	ganjil	2025-11-30 20:09:54.640665+08	2025-11-30 20:09:54.640665+08
\.


--
-- Data for Name: loan_items; Type: TABLE DATA; Schema: public; Owner: lasalle_user
--

COPY public.loan_items (id, loan_id, asset_id, quantity, returned_condition, created_at, returned_at) FROM stdin;
582ae83d-2428-4dd1-a9e8-60578e1f4076	a4c4dba6-00e3-4a73-b692-0b1356a22bb4	08cc0197-b14d-4e46-9b6e-795031c07489	1	\N	2025-11-30 20:09:27.692743+08	\N
f6e6ccb4-d3a3-40c2-be48-0e2db757241e	92d352c6-f4a9-4593-8728-f2093fdb47ec	08cc0197-b14d-4e46-9b6e-795031c07489	1	\N	2025-12-01 17:58:12.942993+08	\N
\.


--
-- Data for Name: loans; Type: TABLE DATA; Schema: public; Owner: lasalle_user
--

COPY public.loans (id, borrower_id, room_id, purpose, start_date, end_date, start_time, end_time, status, academic_year, semester, returned_at, return_notes, created_at, updated_at) FROM stdin;
92d352c6-f4a9-4593-8728-f2093fdb47ec	7910b94f-2259-41a3-acab-122fd7639291	\N	Testing peminjaman	2024-01-20	2024-01-21	08:00:00	10:00:00	menunggu	2023/2024	ganjil	\N	\N	2025-12-01 17:58:12.942993+08	2025-12-01 17:58:12.942993+08
a4c4dba6-00e3-4a73-b692-0b1356a22bb4	7910b94f-2259-41a3-acab-122fd7639291	\N	Testing peminjaman	2024-01-20	2024-01-21	08:00:00	10:00:00	selesai	2023/2024	ganjil	2025-12-05 21:24:45.851484+08		2025-11-30 20:09:27.692743+08	2025-12-05 21:24:45.851484+08
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lasalle_user
--

COPY public.users (id, email, password, name, role, department, student_id, phone, ktm_url, is_active, created_at, updated_at) FROM stdin;
c2447fe1-35e4-47d2-a2a9-57301f546bc3	test@student.ac.id	$2b$10$rB9ozsfYE3Mdpg9/78QSXeZ9dJjOjXHycayAwhyZPkwuoJCWGNXfO	Test User	mahasiswa	\N	\N	\N	\N	t	2025-11-29 13:34:59.16665+08	2025-11-29 13:34:59.16665+08
4163ac01-c7c1-4016-8f79-433e4105fb0e	student@ac.id	$2b$10$4Jl7lk9vR6JD1rSwKRXlR.i0u.5pFDvBqBKkpwcSZDpCpq31h8B5S	Student Test	mahasiswa	Teknik Informatika	123456789	\N	\N	t	2025-11-30 11:29:18.125184+08	2025-11-30 11:29:18.125184+08
1a4daae2-6431-48fe-a728-12a2f9f2ec1b	admin@buf.ac.id	$2b$10$PX82Dmsx6DnAyleh9p8/HOpAEKWIcLwfljaMJhSr1o4Z8ilz0rHoG	Admin BUF	admin_buf	BUF	\N	\N	\N	t	2025-11-30 11:36:47.524879+08	2025-11-30 11:36:47.524879+08
b3527dc5-8b02-4d1a-8f0a-1b4abd850f4b	staf@buf.ac.id	$2b$10$OGQnzT72qXlce3XUcoEHiebnZoz06MKSvNE65LdrAzbast8quv06a	Staf BUF	staf_buf	BUF	\N	\N	\N	t	2025-11-30 11:37:48.982439+08	2025-11-30 11:37:48.982439+08
680c6980-9589-47ca-8763-f0f561d6a9cc	john@student.ac.id	$2b$10$1O/PxqkUBluJFX/gbWbMn.mRD861H0NDRmptK7ZrujrumFdE7ry6i	John Doe	mahasiswa	Teknik Informatika	202401001	081234567890		t	2025-11-30 12:43:06.46147+08	2025-11-30 12:43:06.46147+08
7910b94f-2259-41a3-acab-122fd7639291	melia@student.ac.id	$2b$10$0.Vnprv9H8m8JN13eMxDruzgwWnwfk2pfRs6521ON8GGkmeSNsPz.	Melia	mahasiswa	Teknik Informatika	22013067	08123454566		t	2025-11-30 15:01:18.228033+08	2025-11-30 15:01:18.228033+08
8150e291-fa58-48ea-90c1-473053669473	hani@gmail.com	$2b$10$8RycyPv9H17VunNpyCi30eRls3hLBgOAM3/2y59J/SGI0OcuQn5hS	hani	staf	Manajemen		895342505626	\N	t	2025-12-03 21:03:25.498401+08	2025-12-03 21:03:25.498401+08
\.


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: damage_reports damage_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.damage_reports
    ADD CONSTRAINT damage_reports_pkey PRIMARY KEY (id);


--
-- Name: loan_items loan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.loan_items
    ADD CONSTRAINT loan_items_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_assets_category ON public.assets USING btree (category);


--
-- Name: idx_assets_location; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_assets_location ON public.assets USING btree (location);


--
-- Name: idx_damage_reports_priority; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_damage_reports_priority ON public.damage_reports USING btree (priority);


--
-- Name: idx_damage_reports_status; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_damage_reports_status ON public.damage_reports USING btree (status);


--
-- Name: idx_loans_borrower_id; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_loans_borrower_id ON public.loans USING btree (borrower_id);


--
-- Name: idx_loans_dates; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_loans_dates ON public.loans USING btree (start_date, end_date);


--
-- Name: idx_loans_status; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_loans_status ON public.loans USING btree (status);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: lasalle_user
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: lasalle_user
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: damage_reports update_damage_reports_updated_at; Type: TRIGGER; Schema: public; Owner: lasalle_user
--

CREATE TRIGGER update_damage_reports_updated_at BEFORE UPDATE ON public.damage_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loans update_loans_updated_at; Type: TRIGGER; Schema: public; Owner: lasalle_user
--

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: lasalle_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: damage_reports damage_reports_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.damage_reports
    ADD CONSTRAINT damage_reports_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: damage_reports damage_reports_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.damage_reports
    ADD CONSTRAINT damage_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: loan_items loan_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.loan_items
    ADD CONSTRAINT loan_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: loan_items loan_items_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.loan_items
    ADD CONSTRAINT loan_items_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE CASCADE;


--
-- Name: loans loans_borrower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES public.users(id);


--
-- Name: loans loans_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lasalle_user
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.assets(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO lasalle_user;


--
-- PostgreSQL database dump complete
--

