alter table public.mvp_clients
  add column department text,
  add column city text;

alter table public.mvp_clients
  add constraint mvp_clients_department_length
    check (department is null or length(trim(department)) between 2 and 80),
  add constraint mvp_clients_city_length
    check (city is null or length(trim(city)) between 2 and 80);
